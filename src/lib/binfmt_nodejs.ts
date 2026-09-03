import { boundContexts, fs, xattr } from '@zenfs/core';
import * as path from '@zenfs/core/path';
import type { SignalHandler, SignalName } from '@zenfs/linux';
import { jsBinHandlers, kill, Process, signal_of } from '@zenfs/linux';
import { bindFunctions, pick } from 'utilium';
import { open as editor_open } from '../editor.js';
import * as child_process from './child_process.js';
import { Console } from './console.js';
import * as net from './net.js';
import * as tty from './tty.js';
import { ReadStream, WriteStream } from './tty.js';
import * as util from './util.js';

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

	function signal_event(event: string): SignalName {
		if (!event.startsWith('SIG')) throw new Error(`process events other than signals are not supported ('${event}')`);
		signal_of(event as SignalName);
		return event as SignalName;
	}

	const once_wrappers = new Map<SignalHandler, SignalHandler>();

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
		on(event: string, listener: SignalHandler) {
			proc.sig_action(signal_event(event), listener);
			return process;
		},
		once(event: string, listener: SignalHandler) {
			const signal = signal_event(event);
			const wrapper: SignalHandler = (name, signo) => {
				process.off(event, listener);
				listener(name, signo);
			};
			once_wrappers.set(listener, wrapper);
			proc.sig_action(signal, wrapper);
			return process;
		},
		off(event: string, listener: SignalHandler) {
			const signal = signal_event(event);
			proc.sig_default(signal, once_wrappers.get(listener) ?? listener);
			once_wrappers.delete(listener);
			return process;
		},
		removeListener(event: string, listener: SignalHandler) {
			return process.off(event, listener);
		},
		removeAllListeners(event?: string) {
			if (event) proc.sig_default(signal_event(event));
			else proc.sigHandlers.clear();
			once_wrappers.clear();
			return process;
		},
		listeners(event: string): SignalHandler[] {
			return [...(proc.sigHandlers.get(signal_of(signal_event(event))) ?? [])];
		},
		listenerCount(event: string): number {
			return proc.sigHandlers.get(signal_of(signal_event(event)))?.size ?? 0;
		},
		kill: (pid: number, signal: SignalName | number = 'SIGTERM') => kill(pid, signal),
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
