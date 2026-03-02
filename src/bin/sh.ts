import * as fs from '@zenfs/core';
import * as path from '@zenfs/core/path';

function getPath(): string[] {
	process.env.PATH ||= '/bin';
	return process.env.PATH.split(':');
}

const argPattern = /\s*(?:'([^']*)'|"((?:\\.|[^"\\])*)"|((?:\\.|[^\s"'\\])+))\s*/g;
const nonEscapedLF = /(?<!\\)(?:\\\\)*\n/;

function unescapeToken(s: string) {
	return s.replace(/\\(.)/g, '$1');
}

function* parseArgTokens(line: string): Generator<string> {
	for (const m of line.trim().matchAll(argPattern)) {
		if (m[1] != null) yield m[1];
		else if (m[2] != null) yield unescapeToken(m[2]);
		else if (m[3] != null) yield unescapeToken(m[3]);
	}
}

async function _execLine(line: string) {
	try {
		const args = Array.from(parseArgTokens(line));
		if (!args[0]) return;

		let file: string | undefined;

		for (const dir of getPath()) {
			const p = path.join(dir, args[0]);
			if (fs.existsSync(p)) file = p;
		}

		if (!file) throw 'Unknown command: ' + args[0];

		await exec(file, args, process.env);
	} catch (error: any) {
		if (process.env.DEBUG && error instanceof Error) terminal.writeln(error.stack!);
		terminal.writeln('Error: ' + (error.message ?? error));
	}
}

export default async function main(...args: string[]) {
	if (args.length > 1) {
		const [, file] = args;
		const content = fs.readFileSync(file, 'utf8');
		for (const line of content.split(nonEscapedLF)) await _execLine(line);
		return;
	}
	const shell = createShell({
		terminal,
		get prompt(): string {
			return `[pg@zenfs.dev ${process.cwd() == '/root' ? '~' : path.basename(process.cwd()) || '/'}]$ `;
		},
		onLine: _execLine,
	});
	terminal.write(shell.prompt);
}
