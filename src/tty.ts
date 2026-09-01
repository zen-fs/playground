import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fs } from '@zenfs/core';
import type { TTY } from '@zenfs/linux';
import { attach_xterm, set_console } from '@zenfs/linux';
import $ from 'jquery';

export const terminal = new Terminal({
	// No `convertEol`: ONLCR in the tty's line discipline already turns NL into CR-NL
	rows: 48,
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.write('\x1b[4h'); // Insert mode
terminal.open($('#terminal-container')[0]);

onload = () => fitAddon.fit();
onresize = () => fitAddon.fit();

/** The terminal's tty, i.e. `/dev/xterm0`. Only set once `attach_terminal` has run. */
export let tty: TTY | undefined;

/**
 * Hand the page's terminal to the tty layer and make it the console, so `/dev/tty` and `/dev/console` reach it too.
 */
export function attach_terminal(): void {
	tty = attach_xterm(terminal, { input: false });
	set_console(tty);
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
