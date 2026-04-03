import { fs, defaultContext } from '@zenfs/core';
import { X_OK } from '@zenfs/core/constants';
import * as path from '@zenfs/core/path';
import { UV } from 'kerium';
import { ttyConsole, terminal } from './tty.js';
import { open as __editor_open } from './editor.js';
import 'ses';
import { createShell } from 'utilium/shell';
import type { NamespaceModuleDescriptor } from 'ses';
import { pick } from 'utilium/objects';
import chalk from 'chalk';

globalThis.process = { env: {} } as any;
const { ModuleSource } = await import('@endo/module-source');

const lib = ['/lib'];

const modules: Record<string, NamespaceModuleDescriptor> = {
	fs: { namespace: fs },
	path: { namespace: path },
	'@zenfs/core': { namespace: fs },
	'@zenfs/core/path': { namespace: path },
	chalk: { namespace: { default: chalk } },
};

export default async function exec(filename: string, args: string[], env: Record<string, string>): Promise<void> {
	if (!fs.statSync(filename).hasAccess(X_OK)) throw UV('EACCES', 'exec', filename);

	const code = fs.readFileSync(filename, 'utf-8');

	function $module(source: string) {
		const mod = new ModuleSource(source);
		mod.imports ??= [];
		return mod;
	}

	function $import(specifier: string) {
		if (specifier === '$$main$$') return $module(code);

		const dirs = [...lib, ...(env.LD_LIBRARY_PATH?.split(':') || [])];
		for (const dir of dirs) {
			const p = path.join(dir, specifier + '.js');
			if (fs.existsSync(p)) {
				return $module(fs.readFileSync(p, 'utf-8'));
			}
		}
		throw UV('ELIBACC', 'exec', filename);
	}

	const compartment = new Compartment({
		__options__: true,
		name: filename,
		globals: {
			...pick(globalThis, 'Math', 'Intl', 'Date', 'performance', 'TextEncoder', 'TextDecoder'),
			process: {
				argv: args,
				env,
				cwd() {
					return defaultContext.pwd;
				},
				chdir(directory: string) {
					const newPath = path.join(defaultContext.pwd, directory);
					if (!fs.existsSync(newPath)) throw UV('ENOENT', 'chdir', newPath);
					if (!fs.statSync(newPath).isDirectory()) throw UV('ENOTDIR', 'chdir', newPath);
					defaultContext.pwd = newPath;
				},
			},
			exec,
			console: ttyConsole,
			terminal,
			__editor_open,
			createShell,
		},
		modules,
		resolveHook(specifier: string, referrer: string) {
			return specifier;
		},
		importNowHook: $import,
		importHook: $import,
		noAggregateLoadErrors: true,
	});

	const { namespace: main } = await compartment.import('$$main$$');
	if ('default' in main && typeof main.default == 'function') await main.default(...args);
}
