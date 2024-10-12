import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { fs } from '@zenfs/core';
import { cd, join, resolve, cwd, basename } from '@zenfs/core/emulation/path.js';
import chalk from 'chalk';
import $ from 'jquery';

const terminal = new Terminal();
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.open($('#terminal-container')[0]);
fitAddon.fit();
terminal.write('\x1b[4h');

function ls(dir: string = '.') {
	const list = fs
		.readdirSync(dir)
		.map(name => (fs.statSync(join(dir, name)).isDirectory() ? chalk.blue(name) : name))
		.join(' ');
	terminal.writeln(list);
}

const helpText = `
Virtual FS shell.\r
Available commands: help, ls, cp, cd, mv, rm, cat, stat, pwd, exit/quit\r
`;

function prompt(): string {
	return `[${chalk.green(cwd == '/root' ? '~' : basename(cwd) || '/')}]$ `;
}

function clear(): void {
	terminal.write('\x1b[2K\r' + prompt());
}
terminal.writeln(helpText);
prompt();

let input: string = '';

/**
 * The index for which input is being shown
 */
let index: number = -1;

/**
 * The current, uncached input
 */
let currentInput: string = '';

/**
 * array of previous inputs
 */
const inputs: string[] = [];

function exec(): void {
	if (input == '') {
		return;
	}

	const [command, ...args] = input.trim().split(' ');
	try {
		switch (command) {
			case 'help':
				terminal.writeln(helpText);
				break;
			case 'ls':
				ls(args[0]);
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
			case 'exit':
			case 'quit':
				close();
				return;
			default:
				terminal.writeln('Unknown command: ' + command);
		}
	} catch (error) {
		terminal.writeln('Error: ' + (error as Error).message);
	}

	prompt();
}

terminal.onData(data => {
	if (index == -1) {
		currentInput = input;
	}
	const promptLength = prompt().length;
	const x = terminal.buffer.active.cursorX - promptLength;
	switch (data) {
		case 'ArrowUp':
		case '\x1b[A':
			clear();
			if (index < inputs.length - 1) {
				input = inputs[++index];
			}
			terminal.write(input);
			break;
		case 'ArrowDown':
		case '\x1b[B':
			clear();
			if (index >= 0) {
				input = index-- == 0 ? currentInput : inputs[index];
			}
			terminal.write(input);
			break;
		case '\x1b[D':
			if (x > 0) {
				terminal.write(data);
			}
			break;
		case '\x1b[C':
			if (x < currentInput.length) {
				terminal.write(data);
			}
			break;
		case '\x1b[F':
			terminal.write(`\x1b[${promptLength + currentInput.length + 1}G`);
			break;
		case '\x1b[H':
			terminal.write(`\x1b[${promptLength + 1}G`);
			break;
		case '\x7f':
			if (x <= 0) {
				return;
			}
			terminal.write('\b\x1b[P');
			input = input.slice(0, x - 1) + input.slice(x);
			break;
		case '\r':
			if (input != inputs[0]) {
				inputs.unshift(input);
			}
			index = -1;
			input = '';
			terminal.write('\r\n' + prompt());
			break;
		default:
			terminal.write(data);
			input = input.slice(0, x) + data + input.slice(x);
	}
});

terminal.onLineFeed(exec);
clear();
