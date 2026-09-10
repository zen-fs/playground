import * as fs from 'fs';
import * as path from 'path';
import { createShell } from 'utilium/shell';
import { execFileSync } from 'child_process';
import { styleText } from 'util';

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

		const raw = process.stdin.isRaw;
		if (raw) process.stdin.setRawMode(false);

		try {
			execFileSync(file, args.slice(1), { env: process.env, stdio: 'inherit' });
		} finally {
			if (raw) process.stdin.setRawMode(true);
		}
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

function sourceProfile(file: string): void {
	let content;

	try {
		content = fs.readFileSync(file, 'utf8');
	} catch {
		return;
	}

	for (const line of content.split('\n')) {
		const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
		if (!match || process.env[match[1]] !== undefined) continue;
		process.env[match[1]] = match[2];
	}
}

sourceProfile('/etc/profile');

const root = (process.geteuid?.() ?? 0) == 0;

/** Where the shell is, with the home directory written the way a prompt writes it */
function location(): string {
	const cwd = process.cwd();
	const home = process.env.HOME;
	if (!home || !cwd.startsWith(home)) return cwd;
	return '~' + cwd.slice(home.length);
}

function parts(): [string, string, string, string] {
	return ['[', `${process.env.USERNAME}@${process.env.HOSTNAME}`, ' ' + location(), root ? ']# ' : ']$ '];
}

const shell = createShell({
	stdin: process.stdin,
	stdout: process.stdout,
	get prompt(): string {
		const [open, who, where, end] = parts();
		return styleText('dim', open) + styleText(root ? 'magenta' : 'green', who) + styleText('reset', where) + styleText('dim', end);
	},
	get promptLength(): number {
		return parts().join('').length;
	},
	onLine: _execLine,
});
process.stdout.write(shell.prompt);
