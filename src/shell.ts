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
import * as utilium from 'utilium';
import { open as __editor_open } from './editor.js';

chalk.level = 2;

class _BuiltinFS extends IndexFS {
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

const _builtinFS = new _BuiltinFS($commands_index);
await _builtinFS.ready();

await configure({
	mounts: {
		'/bin': _builtinFS,
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

const __locals = { fs, path, utilium, openPath, __editor_open };

export function exec(__cmdLine: string): void {
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const { fs, path, utilium, openPath: cd, __editor_open } = __locals;
	const args = __cmdLine.trim().split(' ');
	/* eslint-enable @typescript-eslint/no-unused-vars */

	if (!args[0]) {
		return;
	}

	const __filename = '/bin/' + args[0] + '.js';

	if (!fs.existsSync(__filename)) {
		terminal.writeln('Unknown command: ' + args[0]);
		return;
	}

	if (!fs.statSync(__filename).hasAccess(X_OK)) {
		terminal.writeln('Missing permission: ' + args[0]);
		return;
	}

	eval(fs.readFileSync(__filename, 'utf8'));
}

const shell = createShell({
	terminal,
	get prompt(): string {
		return `[pg@zenfs.dev ${path.cwd == '/root' ? '~' : path.basename(path.cwd) || '/'}]$ `;
	},
	/**
	 * @todo output to history file
	 */
	onLine(line) {
		try {
			exec(line);
		} catch (error) {
			terminal.writeln('Error: ' + ((error as Error).message ?? error));
			if ($('#terminal input.debug').is(':checked')) {
				throw error;
			}
		}
	},
});
Object.assign(globalThis, { shell, fs, chalk });
terminal.write(shell.prompt);
