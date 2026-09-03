import * as fs from 'fs';
import * as path from 'path';
import { createShell } from 'utilium/shell';
import { execFileSync } from 'child_process';

const argPattern = /\s*(?:'([^']*)'|"((?:\\.|[^"\\])*)"|((?:\\.|[^\s"'\\])+))\s*/g;
const nonEscapedLF = /(?<!\\)(?:\\\\)*\n/;

function unescapeToken(s: string) {
	return s.replace(/\\(.)/g, '$1');
}

function* parseArgTokens(line: string): Generator<string> {
	for (const m of line.trim().matchAll(argPattern)) {
		if (m[1] != null) yield m[1];
		else if (m[2] != null) yield unescapeToken(m[2]);
		else if (m[3] != null) {
			const token = unescapeToken(m[3]);
			if (!token.includes('*')) yield token;
			else yield* fs.globSync(token);
		}
	}
}

const builtins: Record<string, (...args: string[]) => void> = {
	cd(directory = process.env.HOME || '/') {
		process.chdir(directory);
	},
	exit(rawCode = '0') {
		const code = parseInt(rawCode);
		if (!Number.isSafeInteger(code)) throw 'exit: invalid exit code';
		if (process.pid !== 1) process.exit(code);
		else throw 'exit: refusing to exit because this is the init process';
	},
	'open-editor'(file) {
		void __editor_open(file);
	},
};

function _execLine(line: string) {
	try {
		const args = Array.from(parseArgTokens(line));
		if (!args[0]) return;

		const builtin = builtins[args[0]];
		if (builtin) {
			builtin(...args.slice(1));
			return;
		}

		let file: string | undefined;

		for (const dir of (process.env.PATH ||= '/bin').split(':')) {
			const p = path.join(dir, args[0]);
			if (fs.existsSync(p)) file = p;
		}

		if (!file) throw 'Unknown command: ' + args[0];

		execFileSync(file, args.slice(1), { env: process.env, stdio: 'inherit' });
	} catch (error: any) {
		if (process.env.DEBUG && Error.isError(error)) console.log(error.stack!);
		console.log('Error: ' + (error.message ?? error));
	}
}

const args = process.argv.slice(1);

if (args.length) {
	const [file] = args;
	const content = fs.readFileSync(file, 'utf8');
	for (const line of content.split(nonEscapedLF)) _execLine(line);
	process.exit(0);
}

const shell = createShell({
	stdin: process.stdin,
	stdout: process.stdout,
	get prompt(): string {
		return `[${process.env.USERNAME}@${process.env.HOSTNAME} ${process.cwd() == process.env.HOME ? '~' : path.basename(process.cwd()) || '/'}]$ `;
	},
	onLine: _execLine,
});
process.stdout.write(shell.prompt);
