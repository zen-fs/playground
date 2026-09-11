import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { homedir, hostname, userInfo } from 'os';
import * as path from 'path';
import { styleText } from 'util';
import { createShell } from 'utilium/shell';

const wordPattern = /(?:'[^']*'|"(?:\\.|[^"\\])*"|\\.|[^\s'"\\])+/g;
const segmentPattern = /'([^']*)'|"((?:\\.|[^"\\])*)"|((?:\\.|[^\s'"\\])+)/g;
const assignPattern = /^([A-Za-z_][A-Za-z0-9_]*)=([^]*)$/;
const referencePattern = /\$(?:\{([^}]*)\}|([A-Za-z_][A-Za-z0-9_]*|[?$#@*0-9]))/g;
const globChars = /[*?[]/;
const nonEscapedLF = /(?<!\\)(?:\\\\)*\n/;

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const vars: Record<string, string> = { ...process.env } as Record<string, string>;
const exported = new Set(Object.keys(process.env));

let status = 0;
let name = 'sh';
let positional: string[] = [];

function set(key: string, value: string): void {
	vars[key] = value;
	if (exported.has(key)) process.env[key] = value;
}

function value(key: string): string {
	switch (key) {
		case '?':
			return String(status);
		case '$':
			return String(process.pid);
		case '#':
			return String(positional.length);
		case '@':
		case '*':
			return positional.join(' ');
		case '0':
			return name;
	}

	if (/^[1-9]$/.test(key)) return positional[Number(key) - 1] ?? '';
	return vars[key] ?? '';
}

function expand(text: string): string {
	return text.replace(referencePattern, (_, braced?: string, bare?: string) => value(braced ?? bare ?? ''));
}

function unescapeToken(s: string) {
	return s.replace(/\\(.)/g, '$1');
}

function* parseArgTokens(line: string): Generator<string> {
	let leading = true;

	for (const [word] of line.trim().matchAll(wordPattern)) {
		if (word.startsWith('#')) return;

		let text = '';
		let pattern = false;

		for (const [, single, double, plain] of word.matchAll(segmentPattern)) {
			if (single != null) text += single;
			else if (double != null) text += expand(unescapeToken(double));
			else {
				pattern ||= globChars.test(plain.replace(/\\./g, ''));
				text += expand(unescapeToken(plain));
			}
		}

		if (word.startsWith('~') && (word.length == 1 || word[1] == '/')) text = homedir() + text.slice(1);

		const assignment = assignPattern.test(text);
		leading &&= assignment;

		if (!pattern || assignment) {
			yield text;
			continue;
		}

		const matched = fs.globSync(text);
		yield* matched.length ? matched : [text];
	}
}

/** Run each line of a script, the way the shell would have read them from a terminal */
function run(content: string): void {
	for (const line of content.split(nonEscapedLF)) runLine(line.replace(/\\\n/g, ''));
}

function source(file: string, ...args: string[]): number {
	const found = file.includes('/') ? file : (resolve(file) ?? file);
	const outer = [name, positional] as const;

	if (args.length) positional = args;

	try {
		run(fs.readFileSync(found, 'utf8'));
	} finally {
		[name, positional] = outer;
	}

	return status;
}

const builtins: Record<string, (...args: string[]) => number | void> = {
	cd(directory = homedir() || '/') {
		process.chdir(directory);
	},
	exit(rawCode = String(status)) {
		const code = parseInt(rawCode);
		if (!Number.isSafeInteger(code)) throw 'exit: invalid exit code';
		if (process.pid !== 1) process.exit(code);
		else throw 'exit: refusing to exit because this is the init process';
	},
	export(...names) {
		for (const entry of names) {
			const match = assignPattern.exec(entry);
			const key = match ? match[1] : entry;
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw `export: '${entry}': not a valid identifier`;
			exported.add(key);
			if (match) vars[key] = match[2];
			process.env[key] = vars[key] ?? '';
		}
	},
	unset(...names) {
		for (const key of names) {
			delete vars[key];
			exported.delete(key);
			delete process.env[key];
		}
	},
	source,
	'.': source,
	':': () => 0,
	true: () => 0,
	false: () => 1,
};

/** Where a command name refers to, which for anything containing a `/` is that path and nothing else */
function resolve(command: string): string | undefined {
	if (command.includes('/')) {
		const p = path.resolve(command);
		return fs.existsSync(p) ? p : undefined;
	}

	for (const dir of (process.env.PATH ||= '/bin').split(':')) {
		const p = path.join(dir, command);
		if (fs.existsSync(p)) return p;
	}
}

function runLine(line: string) {
	try {
		const args = Array.from(parseArgTokens(line));
		if (!args[0]) return;

		const env: Record<string, string> = {};

		for (let match = assignPattern.exec(args[0]); args.length && match; match = assignPattern.exec(args[0] ?? '')) {
			env[match[1]] = match[2];
			args.shift();
		}

		if (!args.length) {
			for (const [key, assigned] of Object.entries(env)) set(key, assigned);
			status = 0;
			return;
		}

		const builtin = builtins[args[0]];
		if (builtin) {
			const result = builtin(...args.slice(1));
			status = typeof result == 'number' ? result : 0;
			return;
		}

		const file = resolve(args[0]);
		if (!file) throw `${args[0]}: not found`;

		const raw = process.stdin.isRaw;
		if (raw) process.stdin.setRawMode(false);

		try {
			execFileSync(file, args.slice(1), { env: { ...process.env, ...env }, stdio: 'inherit' });
			status = 0;
		} finally {
			if (raw) process.stdin.setRawMode(true);
		}
	} catch (error) {
		const exited = (error as { status?: number }).status;
		status = typeof exited == 'number' ? exited : 1;

		if (typeof exited == 'number') return;
		if (process.env.DEBUG && Error.isError(error)) console.log(error.stack!);
		console.log('Error: ' + message(error));
	}
}

const argv = process.argv.slice(1);

if (argv[0] == '-c') {
	positional = argv.slice(2);
	run(argv[1] ?? '');
	process.exit(status);
}

if (argv.length) {
	name = argv[0];
	positional = argv.slice(1);

	let script;
	try {
		script = fs.readFileSync(name, 'utf8');
	} catch (error) {
		console.log(`sh: ${name}: ${message(error)}`);
		process.exit(127);
	}

	run(script);
	process.exit(status);
}

/** What `login` puts in the environment before handing over, from the same place it takes it */
function login(): void {
	let who;
	try {
		who = userInfo();
	} catch {
		who = undefined;
	}

	if (!who) return;

	vars.USER ??= who.username;
	vars.LOGNAME ??= who.username;
	vars.HOME ??= who.homedir;
	if (who.shell) vars.SHELL ??= who.shell;

	for (const key of ['USER', 'LOGNAME', 'HOME', 'SHELL']) if (vars[key]) builtins.export(key);
}

login();

if (fs.existsSync('/etc/profile')) source('/etc/profile');

vars.HOSTNAME ??= hostname();
builtins.export('HOSTNAME');

const root = (process.geteuid?.() ?? 0) == 0;

/** Where the shell is, with the home directory written the way a prompt writes it */
function location(): string {
	const cwd = process.cwd();
	const home = homedir();
	if (!home || !cwd.startsWith(home)) return cwd;
	return '~' + cwd.slice(home.length);
}

function parts(): [string, string, string, string] {
	return ['[', `${vars.USER || 'root'}@${hostname()}`, ' ' + location(), root ? ']# ' : ']$ '];
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
	onLine: runLine,
});
process.stdout.write(shell.prompt);
