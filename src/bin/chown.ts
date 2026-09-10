import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		recursive: { short: 'R', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
		'no-dereference': { short: 'h', type: 'boolean', default: false },
		reference: { type: 'string' },
	},
	allowPositionals: true,
});

function table(file: string): string[][] {
	try {
		return fs
			.readFileSync(file, 'utf8')
			.split('\n')
			.filter(line => line && !line.startsWith('#'))
			.map(line => line.split(':'));
	} catch {
		return [];
	}
}

function idOf(rows: string[][], name: string, what: string): number {
	if (/^\d+$/.test(name)) return Number(name);
	const fields = rows.find(fields => fields[0] == name);
	if (!fields) throw `invalid ${what}: '${name}'`;
	return Number(fields[2]);
}

let uid: number | undefined;
let gid: number | undefined;

if (options.reference !== undefined) {
	const stats = fs.statSync(options.reference);
	uid = stats.uid;
	gid = stats.gid;
} else {
	const owner = positionals.shift();
	if (owner === undefined) throw 'missing operand';

	const [user, group] = owner.split(':');
	if (user) uid = idOf(table('/etc/passwd'), user, 'user');
	if (group) gid = idOf(table('/etc/group'), group, 'group');
}

if (!positionals.length) throw 'missing operand';

function apply(target: string): void {
	const stats = fs.lstatSync(target);

	if (!stats.isSymbolicLink() || options['no-dereference']) {
		const to = uid ?? stats.uid;
		const group = gid ?? stats.gid;
		if (options.verbose) console.log(`changed ownership of '${target}' to ${to}:${group}`);
		(stats.isSymbolicLink() ? fs.lchownSync : fs.chownSync)(target, to, group);
	}

	if (options.recursive && stats.isDirectory()) for (const entry of fs.readdirSync(target)) apply(path.join(target, entry));
}

let failed = false;

for (const target of positionals) {
	try {
		apply(target);
	} catch (error) {
		failed = true;
		console.error(`chown: ${target}: ${message(error)}`);
	}
}

if (failed) process.exit(1);
