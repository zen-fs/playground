import { O_APPEND, O_CREAT, O_EXCL, O_RDONLY, O_RDWR, O_TRUNC, O_WRONLY } from '@zenfs/core/constants';
import { Stats } from '@zenfs/core/node/stats';
import type { Stat, StatFs } from '@zenfs/linux/uapi/abi';
import { Whence } from '@zenfs/linux/uapi/abi';
import * as sys from '@zenfs/linux/uapi/fs';
import { pick } from 'utilium';
import { basename, dirname, join } from './path.js';
export * as constants from '@zenfs/core/constants';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export { Stats };

export type PathLike = string | { toString(): string };

function p(path: PathLike): string {
	return path.toString();
}

/** Node's mode strings, i.e. what `open(2)` flags each one means */
const modes: Record<string, number> = {
	r: O_RDONLY,
	'r+': O_RDWR,
	w: O_WRONLY | O_CREAT | O_TRUNC,
	wx: O_WRONLY | O_CREAT | O_TRUNC | O_EXCL,
	'w+': O_RDWR | O_CREAT | O_TRUNC,
	'w+x': O_RDWR | O_CREAT | O_TRUNC | O_EXCL,
	a: O_WRONLY | O_CREAT | O_APPEND,
	ax: O_WRONLY | O_CREAT | O_APPEND | O_EXCL,
	'a+': O_RDWR | O_CREAT | O_APPEND,
	'a+x': O_RDWR | O_CREAT | O_APPEND | O_EXCL,
};

function flagsOf(flag: string | number = 'r'): number {
	if (typeof flag == 'number') return flag;
	const parsed = modes[flag];
	if (parsed === undefined) throw new Error(`Invalid flag: ${flag}`);
	return parsed;
}

export function openSync(path: PathLike, flag: string | number = 'r', mode: number = 0o666): number {
	return sys.open(p(path), flagsOf(flag), mode);
}

export function closeSync(fd: number): void {
	sys.close(fd);
}

export function readSync(fd: number, buffer: Uint8Array, offset: number = 0, length: number = buffer.byteLength - offset, position: number = -1): number {
	return sys.read(fd, buffer.subarray(offset, offset + length), position);
}

export function writeSync(fd: number, data: Uint8Array | string, offset: number = 0, length?: number, position: number = -1): number {
	const buffer = typeof data == 'string' ? encoder.encode(data) : data.subarray(offset, length === undefined ? undefined : offset + length);
	return sys.write(fd, buffer, position);
}

function statsOf(stat: Stat): Stats {
	return new Stats(pick(stat, ['dev', 'ino', 'nlink', 'mode', 'uid', 'gid', 'rdev', 'size', 'blksize', 'atimeMs', 'mtimeMs', 'ctimeMs', 'birthtimeMs']));
}

export function fstatSync(fd: number): Stats {
	return statsOf(sys.fstat(fd));
}

export function statSync(path: PathLike): Stats {
	return statsOf(sys.stat(p(path)));
}

export function lstatSync(path: PathLike): Stats {
	return statsOf(sys.lstat(p(path)));
}

export function existsSync(path: PathLike): boolean {
	try {
		sys.stat(p(path));
		return true;
	} catch {
		return false;
	}
}

/** Everything in a file, read in whatever bites the syscall's region allows */
function readAll(fd: number, size: number): Uint8Array {
	const data = new Uint8Array(size);

	for (let offset = 0; offset < size;) {
		const length = sys.read(fd, data.subarray(offset));
		if (!length) break;
		offset += length;
	}

	return data;
}

export function readFileSync(path: PathLike | number, options?: { encoding?: string | null; flag?: string } | string | null): Uint8Array | string {
	const encoding = typeof options == 'string' ? options : options?.encoding;
	const fd = typeof path == 'number' ? path : openSync(path, typeof options == 'object' ? (options?.flag ?? 'r') : 'r');

	try {
		const data = readAll(fd, sys.fstat(fd).size);
		return encoding ? decoder.decode(data) : data;
	} finally {
		if (typeof path != 'number') sys.close(fd);
	}
}

export function writeFileSync(path: PathLike | number, data: Uint8Array | string, options?: { encoding?: string | null; mode?: number; flag?: string } | string | null): void {
	const flag = typeof options == 'object' ? (options?.flag ?? 'w') : 'w';
	const mode = typeof options == 'object' ? (options?.mode ?? 0o666) : 0o666;
	const fd = typeof path == 'number' ? path : openSync(path, flag, mode);

	try {
		const buffer = typeof data == 'string' ? encoder.encode(data) : data;
		for (let offset = 0; offset < buffer.byteLength;) offset += sys.write(fd, buffer.subarray(offset));
	} finally {
		if (typeof path != 'number') sys.close(fd);
	}
}

export function appendFileSync(path: PathLike | number, data: Uint8Array | string, options?: { mode?: number } | string | null): void {
	writeFileSync(path, data, { flag: 'a', mode: typeof options == 'object' ? options?.mode : undefined });
}

export function mkdirSync(path: PathLike, options?: number | { mode?: number; recursive?: boolean }): string | undefined {
	const mode = typeof options == 'number' ? options : (options?.mode ?? 0o777);
	const recursive = typeof options == 'object' && options?.recursive;

	if (!recursive) {
		sys.mkdir(p(path), mode);
		return;
	}

	let first: string | undefined;

	// One level at a time, since the kernel's `mkdir` is the syscall and makes exactly one
	const parts = p(path).split('/').filter(Boolean);
	let built = p(path).startsWith('/') ? '' : '.';

	for (const part of parts) {
		built += '/' + part;
		if (existsSync(built)) continue;
		sys.mkdir(built, mode);
		first ??= built;
	}

	return first;
}

export function rmdirSync(path: PathLike): void {
	sys.rmdir(p(path));
}

export function unlinkSync(path: PathLike): void {
	sys.unlink(p(path));
}

export function rmSync(path: PathLike, options?: { recursive?: boolean; force?: boolean }): void {
	let stats;
	try {
		stats = lstatSync(path);
	} catch (e) {
		if (options?.force) return;
		throw e;
	}

	if (!stats.isDirectory()) {
		sys.unlink(p(path));
		return;
	}

	if (options?.recursive) for (const entry of readdirSync(path) as string[]) rmSync(join(p(path), entry), options);

	sys.rmdir(p(path));
}

export function readdirSync(path: PathLike, options?: { withFileTypes?: boolean; encoding?: string }): string[] | Dirent[] {
	const fd = sys.open(p(path), 0o200000 /* O_DIRECTORY */);

	try {
		const entries = sys.getdents(fd);
		if (!options?.withFileTypes) return entries.map(entry => entry.name);
		return entries.map(entry => new Dirent(entry.name, entry.type, p(path)));
	} finally {
		sys.close(fd);
	}
}

/** `DT_*` as a file type, which is what `Dirent`'s predicates are asking about */
export class Dirent {
	public constructor(
		public readonly name: string,
		protected readonly type: number,
		public readonly parentPath: string
	) {}

	public get path(): string {
		return this.parentPath;
	}

	public isFile(): boolean {
		return this.type == 8;
	}

	public isDirectory(): boolean {
		return this.type == 4;
	}

	public isSymbolicLink(): boolean {
		return this.type == 10;
	}

	public isBlockDevice(): boolean {
		return this.type == 6;
	}

	public isCharacterDevice(): boolean {
		return this.type == 2;
	}

	public isFIFO(): boolean {
		return this.type == 1;
	}

	public isSocket(): boolean {
		return this.type == 12;
	}
}

export function renameSync(from: PathLike, to: PathLike): void {
	sys.rename(p(from), p(to));
}

export function linkSync(target: PathLike, path: PathLike): void {
	sys.link(p(target), p(path));
}

export function symlinkSync(target: PathLike, path: PathLike): void {
	sys.symlink(p(target), p(path));
}

export function readlinkSync(path: PathLike): string {
	return sys.readlink(p(path));
}

export function realpathSync(path: PathLike): string {
	return sys.realpath(p(path));
}

export function truncateSync(path: PathLike, length: number = 0): void {
	sys.truncate(p(path), length);
}

export function ftruncateSync(fd: number, length: number = 0): void {
	sys.ftruncate(fd, length);
}

export function chmodSync(path: PathLike, mode: number | string): void {
	sys.chmod(p(path), typeof mode == 'string' ? parseInt(mode, 8) : mode);
}

export function fchmodSync(fd: number, mode: number): void {
	sys.fchmod(fd, mode);
}

export function chownSync(path: PathLike, uid: number, gid: number): void {
	sys.chown(p(path), uid, gid);
}

export function lchownSync(path: PathLike, uid: number, gid: number): void {
	sys.chown(p(path), uid, gid);
}

function ms(time: Date | number | string): number {
	return time instanceof Date ? time.getTime() : Number(time) * 1000;
}

export function utimesSync(path: PathLike, atime: Date | number | string, mtime: Date | number | string): void {
	sys.utimes(p(path), ms(atime), ms(mtime));
}

export function futimesSync(fd: number, atime: Date | number | string, mtime: Date | number | string): void {
	sys.futimes(fd, ms(atime), ms(mtime));
}

export function statfsSync(path: PathLike): StatFs {
	return sys.statfs(p(path));
}

export function fstatfsSync(fd: number): StatFs {
	return sys.fstatfs(fd);
}

export function accessSync(path: PathLike, mode: number = 0): void {
	sys.access(p(path), mode);
}

export function fsyncSync(fd: number): void {
	sys.fsync(fd);
}

export function fdatasyncSync(fd: number): void {
	sys.fdatasync(fd);
}

export function ioctlSync(fd: number, request: number, arg?: unknown): number {
	return sys.ioctl(fd, request, arg);
}

export function lseekSync(fd: number, offset: number, whence: Whence = Whence.Set): number {
	return sys.lseek(fd, offset, whence);
}

export function cpSync(from: PathLike, to: PathLike, options?: { recursive?: boolean }): void {
	const stats = lstatSync(from);

	if (stats.isSymbolicLink()) {
		symlinkSync(readlinkSync(from), to);
		return;
	}

	if (!stats.isDirectory()) {
		writeFileSync(to, readFileSync(from), { mode: stats.mode & 0o7777 });
		return;
	}

	if (!options?.recursive) throw Object.assign(new Error(`EISDIR: illegal operation on a directory, cp '${p(from)}'`), { code: 'EISDIR' });

	if (!existsSync(to)) mkdirSync(to, stats.mode & 0o7777);
	for (const entry of readdirSync(from) as string[]) cpSync(join(p(from), entry), join(p(to), entry), options);
}

/** Only the `*` and `?` a shell expands; a full glob is more than anything here asks for */
function globPattern(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	return new RegExp('^' + escaped.replaceAll('*', '[^/]*').replaceAll('?', '[^/]') + '$');
}

export function globSync(pattern: string | readonly string[]): string[] {
	const patterns = typeof pattern == 'string' ? [pattern] : pattern;
	const found: string[] = [];

	for (const one of patterns) {
		const directory = dirname(one);
		const match = globPattern(basename(one));

		let entries: string[];
		try {
			entries = readdirSync(directory) as string[];
		} catch {
			continue;
		}

		for (const entry of entries.sort()) {
			if (!match.test(entry)) continue;
			found.push(one.includes('/') ? join(directory, entry) : entry);
		}
	}

	return found;
}

/** The async half, which here is the sync half with a promise around it */
function promised<A extends unknown[], R>(call: (...args: A) => R): (...args: A) => Promise<R> {
	return (...args: A) => Promise.resolve(call(...args));
}

export const promises = {
	open: promised(openSync),
	readFile: promised(readFileSync),
	writeFile: promised(writeFileSync),
	appendFile: promised(appendFileSync),
	stat: promised(statSync),
	lstat: promised(lstatSync),
	readdir: promised(readdirSync),
	mkdir: promised(mkdirSync),
	rmdir: promised(rmdirSync),
	rm: promised(rmSync),
	unlink: promised(unlinkSync),
	rename: promised(renameSync),
	link: promised(linkSync),
	symlink: promised(symlinkSync),
	readlink: promised(readlinkSync),
	realpath: promised(realpathSync),
	truncate: promised(truncateSync),
	chmod: promised(chmodSync),
	chown: promised(chownSync),
	utimes: promised(utimesSync),
	access: promised(accessSync),
	cp: promised(cpSync),
	glob: promised(globSync),
};
