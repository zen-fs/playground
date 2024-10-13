import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fs } from '@zenfs/core';
import { X_OK } from '@zenfs/core/emulation/constants.js';
import * as path from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';
import { createShell } from 'utilium/shell.js';

const terminal = new Terminal({
	convertEol: true,
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.open($('#terminal-container')[0]);
fitAddon.fit();

terminal.writeln('Virtual FS shell.');

if (!fs.existsSync('/bin')) {
	fs.mkdirSync('/bin');
}

for (const [name, script] of [
	['help', `terminal.writeln('Some unix commands available, ls /bin to see them.');`],
	['ls', `terminal.writeln(fs.readdirSync(args[0] || '.').map(name => (fs.statSync(path.join(args[0] || '.', name)).isDirectory() ? chalk.blue(name) : name)).join(' '))`],
	['cd', `path.cd(args[0] || path.resolve('.'));`],
	['cp', `fs.cpSync(args[0], args[1]);`],
	['mv', `fs.renameSync(args[0], args[1]);`],
	['rm', `fs.unlinkSync(args[0]);`],
	['cat', String.raw`terminal.writeln(fs.readFileSync(args[0], 'utf8'));`],
	['pwd', `terminal.writeln(path.cwd);`],
	['mkdir', `fs.mkdirSync(args[0]);`],
	['echo', `terminal.writeln(args.join(' '));`],
	['stat', `terminal.writeln('[work in progress]'/*inspect(fs.statSync(args[0]), { colors: true })*/)`],
]) {
	fs.writeFileSync('/bin/' + name, script);
	fs.chmodSync('/bin/' + name, 0o555);
}

const exec_locals = { fs, path };

function exec(line: string): void {
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const { fs, path } = exec_locals;
	const [command, ...args] = line.trim().split(' ');
	/* eslint-enable @typescript-eslint/no-unused-vars */

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
		return `[${chalk.green(path.cwd == '/root' ? '~' : path.basename(path.cwd) || '/')}]$ `;
	},
	/**
	 * @todo output to history file
	 */
	onLine(line) {
		try {
			exec(line);
		} catch (error) {
			terminal.writeln('Error: ' + (error as Error).message);
		}
	},
});
Object.assign(globalThis, { shell });
terminal.write(shell.prompt);
