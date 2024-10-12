import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { fs } from '@zenfs/core';
import { cd, join, resolve, cwd, basename } from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';
import { createShell } from 'utilium/shell.js';

const terminal = new Terminal({});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.open($('#terminal-container')[0]);
fitAddon.fit();
terminal.write('\x1b[4h');

const helpText = `Virtual FS shell.\r
Available commands: help, ls, cp, cd, mv, rm, cat, stat, pwd, mkdir, exit/quit\r
`;

terminal.writeln(helpText);

function exec(line: string): void {
	const [command, ...args] = line.trim().split(' ');
	switch (command) {
		case 'help':
			terminal.writeln(helpText);
			break;
		case 'ls':
			terminal.writeln(
				fs
					.readdirSync(args[0] || '.')
					.map(name => (fs.statSync(join(args[0] || '.', name)).isDirectory() ? chalk.blue(name) : name))
					.join(' ')
			);
			break;
		case 'cd':
			cd(args[0] || resolve('.'));
			break;
		case 'cp':
			fs.cpSync(args[0], args[1]);
			break;
		case 'mv':
			fs.renameSync(args[0], args[1]);
			break;
		case 'rm':
			fs.unlinkSync(args[0]);
			break;
		case 'cat':
			terminal.writeln(fs.readFileSync(args[0], 'utf8'));
			break;
		case 'stat':
			//terminal.writeln(inspect(fs.statSync(args[0]), { colors: true }));
			break;
		case 'pwd':
			terminal.writeln(cwd);
			break;
		case 'mkdir':
			fs.mkdirSync(args[0]);
			break;
		case 'echo':
			terminal.writeln(args[0]);
			break;
		case 'exit':
		case 'quit':
			close();
			return;
		default:
			terminal.writeln('Unknown command: ' + command);
	}
}

const shell = createShell({
	terminal,
	get prompt(): string {
		return `[${chalk.green(cwd == '/root' ? '~' : basename(cwd) || '/')}]$ `;
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
(globalThis as typeof globalThis & { shell: typeof shell }).shell = shell;
terminal.write(shell.prompt);
