import { ModuleSource } from '@endo/module-source';
import * as fs from '@zenfs/linux/uapi/fs';
import * as proc from '@zenfs/linux/uapi/process';
import { decodeUTF8 } from 'utilium';

export const modules: Record<string, object> = Object.create(null);

/** Where a bare specifier is looked for, before `LD_LIBRARY_PATH` */
export const library_paths: string[] = ['/lib'];

export const handles = new Set<() => void>();

const O_RDONLY = 0;

function read_file(path: string): string {
	const fd = fs.open(path, O_RDONLY);

	try {
		const { size } = fs.fstat(fd);
		const data = new Uint8Array(size);

		for (let offset = 0; offset < size;) {
			const length = fs.read(fd, data.subarray(offset));
			if (!length) break;
			offset += length;
		}

		return decodeUTF8(data);
	} finally {
		fs.close(fd);
	}
}

function directory_of(path: string): string {
	const cut = path.lastIndexOf('/');
	return cut <= 0 ? '/' : path.slice(0, cut);
}

/** Fold away `.` and `..`, so a relative import ends up with the same key however it was reached */
export function normalize(path: string): string {
	const parts: string[] = [];

	for (const part of path.split('/')) {
		if (!part || part == '.') continue;
		if (part == '..') parts.pop();
		else parts.push(part);
	}

	return '/' + parts.join('/');
}

export function resolve(specifier: string, referrer: string): string {
	if (specifier in modules) return specifier;

	if (specifier.startsWith('/')) return normalize(specifier);
	if (specifier.startsWith('.')) return normalize(directory_of(referrer) + '/' + specifier);

	// Node's own modules are asked for either way around, and neither spelling is a file
	const name = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
	if (name in modules) return name;

	const bare = name.replace(/\.js$/, '');
	if (bare in modules) return bare;

	for (const directory of search_path()) {
		const path = normalize(`${directory}/${name}.js`);
		try {
			fs.stat(path);
			return path;
		} catch {
			// Not in this one
		}
	}

	throw new Error(`Cannot find module '${specifier}' imported from '${referrer}'`);
}

function search_path(): string[] {
	const extra = proc.environ().LD_LIBRARY_PATH;
	return extra ? [...library_paths, ...extra.split(':')] : library_paths;
}

export function load(specifier: string) {
	const module = new ModuleSource(read_file(specifier));
	module.imports ??= [];
	return module;
}
