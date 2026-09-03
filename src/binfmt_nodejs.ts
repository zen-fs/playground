import { boundContexts, fs, xattr } from '@zenfs/core';
import * as path from '@zenfs/core/path';
import { jsBinHandlers, Process } from '@zenfs/linux';
import { bindFunctions, pick } from 'utilium';
import { open as editor_open } from './editor.js';
import * as child_process from './lib/child_process.js';
import { Console } from './lib/console.js';
import * as net from './lib/net.js';
import * as tty from './lib/tty.js';
import { ReadStream, WriteStream } from './lib/tty.js';
import * as util from './lib/util.js';

const hostGlobals = pick(
	globalThis,
	'Intl',
	'performance',
	'crypto',
	'URL',
	'URLSearchParams',
	'AbortController',
	'AbortSignal',
	'Blob',
	'structuredClone',
	'queueMicrotask',
	'atob',
	'btoa',
	'setTimeout',
	'clearTimeout',
	'setInterval',
	'clearInterval'
);

jsBinHandlers.add(function nodejs(proc: Process) {
	const $ = proc.context;

	const bound = boundContexts.get($.id) || {
		fs: {
			...bindFunctions(fs, $),
			Utf8Stream: fs.Utf8Stream._withContext($),
			promises: bindFunctions(fs.promises, $),
			xattr: bindFunctions(xattr, $),
		},
		path: bindFunctions(path, $),
	};

	const stdin = new ReadStream(proc, 0);
	const stdout = new WriteStream(proc, 1);
	const stderr = new WriteStream(proc, 2);

	const process = {
		platform: 'linux',
		get pid() {
			return proc.pid;
		},
		get ppid() {
			return proc.ppid;
		},
		argv: Array.from(proc.argv),
		env: proc.env,
		stdin,
		stdout,
		stderr,
		cwd: () => proc.cwd,
		chdir: (directory: string) => proc.chdir(directory),
		exit: (code?: number) => {
			proc.code = code;
			// @todo can't throw an error because that would violate correctness inside try/catch
			throw Process.exit;
		},
	};

	const console = new Console({ stdout, stderr });

	const mod = { util, tty, net, process, console, child_process };

	return {
		modules: {
			fs: bound.fs,
			'node:fs': bound.fs,
			path: bound.path,
			'node:path': bound.path,
			...Object.fromEntries(
				Object.entries(mod).flatMap(([key, value]) => {
					const bound = bindFunctions(value, proc);
					return [
						[key, bound],
						[`node:${key}`, bound],
					];
				})
			),
		},
		globals: {
			...hostGlobals,
			process,
			console,
			__editor_open: editor_open.bind($),
		},
	};
});
