import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import type { DeviceDriver } from '@zenfs/core';
import chalk from 'chalk';
import $ from 'jquery';

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

const empty = new Uint8Array();

export const TTY = {
	name: 'tty',
	singleton: true,
	init(ino: number) {
		return { major: 5, minor: 0 };
	},
	read() {
		return empty;
	},
	write(device, buffer) {
		terminal.write(buffer);
	},
} satisfies DeviceDriver;

function log(...args: any[]) {
	terminal.writeln(args.join(' '));
}

export const ttyConsole = {
	debug: log,
	log: log,
	info: log,
	warn: log,
	error: log,
};
