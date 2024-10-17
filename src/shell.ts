import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fs, resolveMountConfig as __mount_resolve } from '@zenfs/core';
import * as path from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';
import * as utilium from 'utilium';
import { createShell } from 'utilium/shell.js';
import { openPath as __open } from './common.js';
import { open as __editor_open } from './editor.js';
import { X_OK } from '@zenfs/core/emulation/constants.js';
import type { ExecutionLocals } from '../commands/lib.js';
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

/**
 * Handles removing TS-specific stuff
 */
function parse_source(source: string): string {
	return source.replaceAll(/^\s*export {};\s*\n/g, '');
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

	const source = parse_source(fs.readFileSync(filename, 'utf8'));

	const locals = { args, fs, path, chalk, utilium, terminal, __open, __editor_open, __mount_resolve } satisfies ExecutionLocals;

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
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw error;
			}
		});
	},
});
Object.assign(globalThis, { shell, fs, chalk });
terminal.write(shell.prompt);
