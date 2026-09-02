import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fs } from '@zenfs/core';
import type { TTY, Termios, TTYIoctlOps } from '@zenfs/linux';
import { attach_xterm, iflags, lflags, TtyIoctl } from '@zenfs/linux';
import $ from 'jquery';

// No `convertEol`: ONLCR in the tty's line discipline already turns NL into CR-NL
export const terminal = new Terminal({ rows: 48 });
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.open($('#terminal-container')[0]);

onload = () => fitAddon.fit();
onresize = () => fitAddon.fit();

/** The terminal's tty, i.e. `/dev/xterm0`. Only set once `attach_terminal` has run. */
export let tty: TTY | undefined;

/**
 * Hand the page's terminal to the tty layer and make it the console, so `/dev/tty` and `/dev/console` reach it too.
 */
export function attach_terminal(): void {
	tty = attach_xterm(terminal);
}

/**
 * What the programs in `/bin` write to.
 */
export const stdout = {
	write(data: string): void {
		fs.writeFileSync('/dev/tty', data);
	},
	get columns(): number {
		return tty?.winsize.cols ?? terminal.cols;
	},
	get rows(): number {
		return tty?.winsize.rows ?? terminal.rows;
	},
};

type DataListener = (chunk: string) => void;

const listeners = new Set<DataListener>();
const decoder = new TextDecoder();

/** The open `/dev/tty`, i.e. what a program's file descriptor 0 would be */
let fd: number | undefined;

/** What `wait_read` gave back, only set while the terminal is being read */
let stop_waiting: (() => void) | undefined;

/** The line settings from before raw mode, so `setRawMode(false)` can put them back */
let cooked: Termios | undefined;

/**
 * Take everything the terminal has and hand it over.
 * A read can't report how much it got, so `FIONREAD` is what says how much there is.
 */
function drain(): void {
	const count = fs.ioctlSync<TtyIoctl.InputQueue, TTYIoctlOps>('/dev/tty', TtyIoctl.InputQueue);
	if (!count || fd === undefined) return;

	const buffer = new Uint8Array(count);
	fs.readSync(fd, buffer, 0, count, 0);

	const data = decoder.decode(buffer, { stream: true });
	for (const listener of [...listeners]) listener(data);
}

/**
 * What the programs in `/bin` read from.
 */
export const stdin = {
	isTTY: true,

	on(event: 'data', listener: DataListener): void {
		if (event != 'data') return;
		listeners.add(listener);
	},

	off(event: 'data', listener: DataListener): void {
		if (event != 'data') return;
		listeners.delete(listener);
	},

	/**
	 * Hand keystrokes over as they are typed rather than a line at a time, i.e. what `cfmakeraw`
	 * does to the input flags. Output processing is left alone, the way Node's `setRawMode` leaves
	 * it, so everything else writing to the terminal still gets its newlines turned into CR-NL.
	 */
	setRawMode(raw: boolean): void {
		if (!raw) {
			if (cooked) fs.ioctlSync<TtyIoctl.SetTermios, TTYIoctlOps>('/dev/tty', TtyIoctl.SetTermios, cooked);
			cooked = undefined;
			return;
		}

		const termios = fs.ioctlSync<TtyIoctl.GetTermios, TTYIoctlOps>('/dev/tty', TtyIoctl.GetTermios);
		cooked ??= termios;
		fs.ioctlSync<TtyIoctl.SetTermios, TTYIoctlOps>('/dev/tty', TtyIoctl.SetTermios, {
			iflag: termios.iflag & ~(iflags.ISTRIP | iflags.INLCR | iflags.IGNCR | iflags.ICRNL),
			lflag: termios.lflag & ~(lflags.ICANON | lflags.ECHO | lflags.ISIG),
		});
	},

	resume(): void {
		if (!tty || stop_waiting) return;
		fd ??= fs.openSync('/dev/tty', 'r');
		stop_waiting = tty.wait_read(drain);
		drain();
	},

	pause(): void {
		stop_waiting?.();
		stop_waiting = undefined;
	},
};

function log(...args: any[]) {
	fs.writeFileSync('/dev/tty', args.join(' ') + '\n');
}

export const ttyConsole = {
	debug: log,
	log: log,
	info: log,
	warn: log,
	error: log,
};
