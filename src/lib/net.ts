import { fs } from '@zenfs/core';
import type { Process } from '@zenfs/linux';
import { EventEmitter } from 'eventemitter3';
import type * as net from 'node:net';

const encoder = new TextEncoder();

const writeSync: (this: unknown, fd: number, data: Uint8Array, offset: number, length: number) => number = fs.writeSync;

export interface SocketEvents {
	data: (chunk: string) => void;
	end: () => void;
	close: () => void;
	error: (error: Error) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Socket extends Omit<net.Socket, keyof EventEmitter<SocketEvents>> {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Socket extends EventEmitter<SocketEvents> {
	readonly #proc: Process;

	protected readonly ioctl = ((...args: Parameters<typeof fs.ioctlSync>) => fs.ioctlSync.apply(this.#proc.context, args)) as OmitThisParameter<typeof fs.ioctlSync>;

	public constructor(
		proc: Process,
		public readonly fd: number
	) {
		super();
		this.#proc = proc;
	}

	protected readInto(buffer: Uint8Array, length: number): number {
		return fs.readSync.call(this.#proc.context, this.fd, buffer, 0, length, 0);
	}

	protected waitRead(callback: () => void): (() => void) | undefined {
		return this.#proc.tty?.wait_read(callback);
	}

	public get isTTY(): boolean {
		return false;
	}

	public write(data: string | Uint8Array): boolean {
		const buffer = typeof data == 'string' ? encoder.encode(data) : data;
		writeSync.call(this.#proc.context, this.fd, buffer, 0, buffer.byteLength);
		return true;
	}

	public end(callback?: () => void): this;
	public end(data: string | Uint8Array, callback?: () => void): this;
	public end(data: string | Uint8Array, encoding?: BufferEncoding, callback?: () => void): this;
	public end(data?: string | Uint8Array | (() => void), encoding?: BufferEncoding | (() => void), callback?: () => void): this {
		if (typeof data == 'function') callback = data;
		else if (data !== undefined) this.write(data);

		if (typeof encoding == 'function') callback = encoding;

		this.emit('end');
		callback?.();
		return this;
	}
}
