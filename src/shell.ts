/* eslint-disable @typescript-eslint/only-throw-error */
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { resolveMountConfig as __mount_resolve, fs } from '@zenfs/core';
import { X_OK } from '@zenfs/core/emulation/constants.js';
import * as path from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';
import { createShell } from 'utilium/shell.js';
import { openPath as __open } from './common.js';
import { open as __editor_open } from './editor.js';
chalk.level = 2;

export const terminal = new Terminal({
	convertEol: true,
	rows: 48,
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.write('\x1b[4h'); // Insert mode
terminal.open($('#terminal-container')[0]);
fitAddon.fit();

const AsyncFunction = async function () {}.constructor as (...args: string[]) => (...args: unknown[]) => Promise<void>;

const import_regex = /import (\* as )?(\w+) from '([^']+)';/g;

/**
 * Handles linking and stuff
 */
async function parse_source(source: string): Promise<{ source: string; imports: Record<string, unknown> }> {
	// Replace any expressions used to force TS into module mode
	source = source.replaceAll(/^\s*export {};\s*\n/g, '');

	const imports = Object.create(null) as Record<string, unknown>;
	let match: RegExpExecArray | null;
	while ((match = import_regex.exec(source))) {
		const [, isNamespace, binding, specifier] = match;

		const lib_path = `/lib/${specifier}.js`;

		if (!fs.existsSync(lib_path)) {
			throw 'Could not locate library: ' + specifier;
		}

		const lib_contents = fs.readFileSync(lib_path, 'utf-8');

		const url = URL.createObjectURL(new Blob([lib_contents], { type: 'text/javascript' }));

		const _module = await import(url);

		if (specifier == 'chalk') {
			_module.default.level = 2;
		}

		imports[binding] = isNamespace ? _module : _module.default;

		URL.revokeObjectURL(url);
	}

	source = source.replaceAll(import_regex, '');

	return { source, imports };
}

export async function exec(line: string): Promise<void> {
	const args = line.trim().split(' ');

	if (!args[0]) {
		return;
	}

	const filename = '/bin/' + args[0] + '.js';

	if (!fs.existsSync(filename)) {
		terminal.writeln('Unknown command: ' + args[0]);
		return;
	}

	if (!fs.statSync(filename).hasAccess(X_OK)) {
		terminal.writeln('Missing permission: ' + args[0]);
		return;
	}

	const { source, imports } = await parse_source(fs.readFileSync(filename, 'utf8'));

	const locals = { args, fs, terminal, __open, __editor_open, __mount_resolve, ...imports };

	if ($('#terminal input.debug').is(':checked')) {
		console.debug('EXEC:\nlocals:', locals, '\nsource:', source);
	}

	await AsyncFunction(`{${Object.keys(locals).join(',')}}`, source)(locals);
}

const shell = createShell({
	terminal,
	get prompt(): string {
		return `[pg@zenfs.dev ${path.cwd == '/root' ? '~' : path.basename(path.cwd) || '/'}]$ `;
	},
	/**
	 * @todo output to history file
	 */
	async onLine(line) {
		await exec(line).catch((error: Error | string) => {
			terminal.writeln('Error: ' + ((error as Error).message ?? error));
			if ($('#terminal input.debug').is(':checked')) {
				throw error;
			}
		});
	},
});
Object.assign(globalThis, { shell, fs, chalk });
terminal.write(shell.prompt);
