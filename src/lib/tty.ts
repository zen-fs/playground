import type { Process, Termios, TTYIoctlOps, WinSize } from '@zenfs/linux';
import { iflags, lflags, TtyIoctl } from '@zenfs/linux';
import { Socket } from './net.js';

/** What is used when the terminal can't say how big it is */
const fallbackWinSize: WinSize = { rows: 24, cols: 80 };

export class WriteStream extends Socket {
	public constructor(proc: Process, fd: number = 1) {
		super(proc, fd);
	}

	public override get isTTY(): boolean {
		return this.winsize !== undefined;
	}

	/** The terminal's size, or nothing when the descriptor isn't a terminal (`ENOTTY`) */
	protected get winsize(): WinSize | undefined {
		try {
			return this.ioctl<TtyIoctl.GetWinsize, TTYIoctlOps>(this.fd, TtyIoctl.GetWinsize);
		} catch {
			return undefined;
		}
	}

	public get columns(): number {
		return (this.winsize ?? fallbackWinSize).cols;
	}

	public get rows(): number {
		return (this.winsize ?? fallbackWinSize).rows;
	}
}

export type DataListener = (chunk: string) => void;

export class ReadStream extends Socket {
	protected readonly decoder = new TextDecoder();

	/** What `wait_read` gave back, only set while the terminal is being read */
	protected stopWaiting?: () => void;

	/** The line settings from before raw mode, so `setRawMode(false)` can put them back */
	protected cooked?: Termios;

	public constructor(proc: Process, fd: number = 0) {
		super(proc, fd);
	}

	public override get isTTY(): boolean {
		return true;
	}

	/**
	 * Take everything the terminal has and hand it over.
	 * A read can't report how much it got, so `FIONREAD` is what says how much there is.
	 */
	protected readonly drain = (): void => {
		const count = this.ioctl<TtyIoctl.InputQueue, TTYIoctlOps>(this.fd, TtyIoctl.InputQueue);
		if (!count) return;

		const buffer = new Uint8Array(count);
		this.readInto(buffer, count);

		this.emit('data', this.decoder.decode(buffer, { stream: true }));
	};

	/**
	 * Hand keystrokes over as they are typed rather than a line at a time, i.e. what `cfmakeraw`
	 * does to the input flags. Output processing is left alone, the way Node's `setRawMode` leaves
	 * it, so everything else writing to the terminal still gets its newlines turned into CR-NL.
	 */
	public setRawMode(raw: boolean): this {
		if (!raw) {
			if (this.cooked) this.ioctl<TtyIoctl.SetTermios, TTYIoctlOps>(this.fd, TtyIoctl.SetTermios, this.cooked);
			this.cooked = undefined;
			return this;
		}

		const termios = this.ioctl<TtyIoctl.GetTermios, TTYIoctlOps>(this.fd, TtyIoctl.GetTermios);
		this.cooked ??= termios;
		this.ioctl<TtyIoctl.SetTermios, TTYIoctlOps>(this.fd, TtyIoctl.SetTermios, {
			iflag: termios.iflag & ~(iflags.ISTRIP | iflags.INLCR | iflags.IGNCR | iflags.ICRNL),
			lflag: termios.lflag & ~(lflags.ICANON | lflags.ECHO | lflags.ISIG),
		});
		return this;
	}

	public readonly resume = (): this => {
		if (this.stopWaiting) return this;
		this.stopWaiting = this.waitRead(this.drain);
		if (this.stopWaiting) this.drain();
		return this;
	};

	public readonly pause = (): this => {
		this.stopWaiting?.();
		this.stopWaiting = undefined;
		return this;
	};
}
