import { globals, modules } from '@zenfs/linux/uapi/exec';
import * as child_process from './lib/child_process.js';
import { Console } from './lib/console.js';
import * as fs from './lib/fs.js';
import * as net from './lib/net.js';
import * as path from './lib/path.js';
import { process, stderr, stdout } from './lib/process.js';
import * as tty from './lib/tty.js';
import * as util from './lib/util.js';

const console = new Console({ stdout, stderr });

/** What the host provides that a program can have as-is: none of it can reach the kernel */
const hostGlobals = Object.fromEntries(
	(
		[
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
			'clearInterval',
		] as const
	)
		.filter(name => name in globalThis)
		.map(name => [name, (globalThis as unknown as Record<string, unknown>)[name]])
);

for (const [name, value] of Object.entries({ child_process, console, fs, net, path, process, tty, util })) {
	modules[name] = value;
	modules[`node:${name}`] = value;
}

Object.assign(globals, hostGlobals, { process, console });
