import type { Process } from '@zenfs/linux';
import { spawn } from '@zenfs/linux';
import type * as child_process from 'node:child_process';

type Options = child_process.ExecFileSyncOptions;

export function execFileSync(this: Process, file: string, args?: readonly string[] | Options, options?: Options): never {
	const argv = Array.isArray(args) ? (args as readonly string[]) : [];
	const opts = (Array.isArray(args) ? options : (args as Options | undefined)) ?? {};

	const env = (opts.env as Record<string, string> | undefined) ?? this.env;
	const status = spawn(this, file, [file, ...argv], env, { cwd: opts.cwd?.toString() });

	if (status) throw Object.assign(new Error(`Command failed: ${[file, ...argv].join(' ')}`), { status, code: status });

	return (opts.encoding ? '' : new Uint8Array(0)) as never;
}

execFileSync satisfies typeof child_process.execFileSync;
