import { ioctl, read, write } from '@zenfs/linux/uapi/fs';
import { EventEmitter } from 'eventemitter3';
import type * as net from 'node:net';

const encoder = new TextEncoder();

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
	public constructor(public readonly fd: number) {
		super();
	}

	protected ioctl(request: number, arg?: unknown): number {
		return ioctl(this.fd, request, arg);
	}

	protected readInto(buffer: Uint8Array): number {
		return read(this.fd, buffer);
	}

	public get isTTY(): boolean {
		return false;
	}

	public write(data: string | Uint8Array): boolean {
		const buffer = typeof data == 'string' ? encoder.encode(data) : data;
		for (let offset = 0; offset < buffer.byteLength;) offset += write(this.fd, buffer.subarray(offset));
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
