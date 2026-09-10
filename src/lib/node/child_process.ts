import { environ, spawn, wait } from '@zenfs/linux/uapi/process';
import type * as child_process from 'node:child_process';

type Options = child_process.ExecFileSyncOptions;

/**
 * Start a program and wait for it.
 */
export function execFileSync(file: string, args?: readonly string[] | Options, options?: Options): never {
	const argv = Array.isArray(args) ? (args as readonly string[]) : [];
	const opts = (Array.isArray(args) ? options : (args as Options | undefined)) ?? {};

	const env = (opts.env as Record<string, string> | undefined) ?? environ();

	const pid = spawn(file, [file, ...argv], env);
	const status = wait(pid);

	if (status) throw Object.assign(new Error(`Command failed: ${[file, ...argv].join(' ')}`), { status, code: status });

	return (opts.encoding ? '' : new Uint8Array(0)) as never;
}

execFileSync satisfies typeof child_process.execFileSync;
