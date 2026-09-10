import type { TermiosFields } from '@zenfs/linux/uapi/abi';
import { iflags, lflags } from '@zenfs/linux/uapi/abi';
import { tcgetattr, tcsetattr, winsize } from '@zenfs/linux/uapi/fs';
import { handles } from './modules.js';
import { Socket } from './net.js';

/** What is used when the terminal can't say how big it is */
const fallbackWinSize = { row: 24, col: 80 };

export class WriteStream extends Socket {
	public override get isTTY(): boolean {
		return this.winsize !== undefined;
	}

	/** The terminal's size, or nothing when the descriptor isn't a terminal (`ENOTTY`) */
	protected get winsize(): { row: number; col: number } | undefined {
		try {
			return winsize(this.fd);
		} catch {
			return undefined;
		}
	}

	public get columns(): number {
		return (this.winsize ?? fallbackWinSize).col;
	}

	public get rows(): number {
		return (this.winsize ?? fallbackWinSize).row;
	}
}

export type DataListener = (chunk: string) => void;

/**
 * The reading half of a terminal.
 */
export class ReadStream extends Socket {
	protected readonly decoder = new TextDecoder();

	protected readonly buffer = new Uint8Array(4096);

	/** The line settings from before raw mode, so `setRawMode(false)` can put them back */
	protected cooked?: TermiosFields;

	public override get isTTY(): boolean {
		return true;
	}

	/** Block until the terminal has something, then hand it over */
	protected readonly drain = (): void => {
		const length = this.readInto(this.buffer);

		if (!length) {
			this.pause();
			this.emit('end');
			return;
		}

		this.emit('data', this.decoder.decode(this.buffer.subarray(0, length), { stream: true }));
	};

	/**
	 * Hand keystrokes over as they are typed rather than a line at a time, i.e. what `cfmakeraw`
	 * does to the input flags. Output processing is left alone, the way Node's `setRawMode` leaves
	 * it, so everything else writing to the terminal still gets its newlines turned into CR-NL.
	 */
	public setRawMode(raw: boolean): this {
		if (!raw) {
			if (this.cooked) tcsetattr(this.fd, this.cooked);
			this.cooked = undefined;
			return this;
		}

		const termios = tcgetattr(this.fd);
		this.cooked ??= termios;

		tcsetattr(this.fd, {
			iflag: termios.iflag & ~(iflags.ISTRIP | iflags.INLCR | iflags.IGNCR | iflags.ICRNL),
			lflag: termios.lflag & ~(lflags.ICANON | lflags.ECHO | lflags.ISIG),
		});

		return this;
	}

	public readonly resume = (): this => {
		handles.add(this.drain);
		return this;
	};

	public readonly pause = (): this => {
		handles.delete(this.drain);
		return this;
	};
}
