import { ready } from '@zenfs/linux/uapi/base';
import * as proc from '@zenfs/linux/uapi/process';
import 'ses';
import type { NamespaceModuleDescriptor } from 'ses';
import * as child_process from './child_process.js';
import { Console } from './console.js';
import * as fs from './fs.js';
import * as esm from './modules.js';
import * as net from './net.js';
import * as os from './os.js';
import * as path from './path.js';
import { process, stderr, stdout } from './process.js';
import * as tty from './tty.js';
import * as util from './util.js';

const console = new Console({ stdout, stderr });

const globals: Record<string, unknown> = Object.assign(Object.create(null), {
	TextEncoder,
	TextDecoder,
	console,
	process,
});

for (const key of [
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
] as const) {
	if (!(key in globalThis)) continue;
	globals[key] = globalThis[key];
}

Object.assign(esm.modules, {
	child_process,
	console,
	fs,
	net,
	os,
	path,
	process,
	tty,
	util,
});

const init = await ready;

const program = init.exe == init.interpreter ? init.argv[1] : init.exe;

if (!program) {
	console.error(`${init.interpreter}: no program to run`);
	proc.exit(2);
}

try {
	const namespaces: Record<string, NamespaceModuleDescriptor> = Object.create(null);
	for (const [name, namespace] of Object.entries(esm.modules)) namespaces[name] = { namespace };

	const compartment = new Compartment({
		__options__: true,
		name: program,
		globals,
		modules: namespaces,
		resolveHook: esm.resolve,
		importNowHook: esm.load,
		importHook: esm.load,
		noAggregateLoadErrors: true,
	});

	await compartment.import(esm.normalize(program));

	while (esm.handles.size) {
		for (const handle of [...esm.handles]) {
			handle();
			await new Promise(resolve => setTimeout(resolve, 0));
		}
	}

	proc.exit(0);
} catch (e) {
	console.error(String(e));
	proc.exit(1);
}
