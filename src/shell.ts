import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { configure, encode, fs, IndexFS } from '@zenfs/core';
import { X_OK } from '@zenfs/core/emulation/constants.js';
import * as path from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';
import { createShell } from 'utilium/shell.js';
import { openPath } from './common.js';

chalk.level = 2;

class _CommandsFS extends IndexFS {
	public async ready(): Promise<void> {
		if (this._isInitialized) {
			return;
		}
		await super.ready();

		if (this._disableSync) {
			return;
		}

		/**
		 * Iterate over all of the files and cache their contents
		 */
		for (const [path, stats] of this.index.files()) {
			await this.getData(path);
		}
	}
	protected getData(path: string): Promise<Uint8Array> {
		return Promise.resolve(encode($commands[path]));
	}
	protected getDataSync(path: string): Uint8Array {
		return encode($commands[path]);
	}
}

const _cmdFS = new _CommandsFS($commands_index);
await _cmdFS.ready();

await configure({
	mounts: {
		'/bin': _cmdFS,
	},
});

const terminal = new Terminal({
	convertEol: true,
	rows: 48,
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.write('\x1b[4h'); // Insert mode
terminal.open($('#terminal-container')[0]);
fitAddon.fit();

const exec_locals = { fs, path, openPath };

function exec(line: string): void {
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const { fs, path, openPath: cd } = exec_locals;
	const [command, ...args] = line.trim().split(' ');
	/* eslint-enable @typescript-eslint/no-unused-vars */

	if (!command) {
		return;
	}

	if (!fs.existsSync('/bin/' + command)) {
		terminal.writeln('Unknown command: ' + command);
		return;
	}

	if (!fs.statSync('/bin/' + command).hasAccess(X_OK)) {
		terminal.writeln('Missing permission: ' + command);
		return;
	}

	eval(fs.readFileSync('/bin/' + command, 'utf8'));
}

const shell = createShell({
	terminal,
	get prompt(): string {
		return `[pg@zenfs.dev ${chalk.green(path.cwd == '/root' ? '~' : path.basename(path.cwd) || '/')}]$ `;
	},
	get promptLength(): number {
		return (path.cwd == '/root' ? '~' : path.basename(path.cwd) || '/').length + 17;
	},
	/**
	 * @todo output to history file
	 */
	onLine(line) {
		try {
			exec(line);
		} catch (error) {
			terminal.writeln('Error: ' + (error as Error).message);
			if ($('#terminal input.debug').is(':checked')) {
				throw error;
			}
		}
	},
});
Object.assign(globalThis, { shell, fs, chalk });
terminal.write(shell.prompt);
