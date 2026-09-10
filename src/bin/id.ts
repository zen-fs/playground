import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		user: { short: 'u', type: 'boolean', default: false },
		group: { short: 'g', type: 'boolean', default: false },
		groups: { short: 'G', type: 'boolean', default: false },
		name: { short: 'n', type: 'boolean', default: false },
		real: { short: 'r', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

function table(path: string): string[][] {
	try {
		return fs
			.readFileSync(path, 'utf8')
			.split('\n')
			.filter(line => line && !line.startsWith('#'))
			.map(line => line.split(':'));
	} catch {
		return [];
	}
}

const passwd = table('/etc/passwd');
const groups = table('/etc/group');

function nameOf(rows: string[][], id: number): string | undefined {
	return rows.find(fields => Number(fields[2]) == id)?.[0];
}

if (positionals.length > 1) throw `extra operand '${positionals[1]}'`;

let uid = options.real ? (process.getuid?.() ?? 0) : (process.geteuid?.() ?? 0);
let gid = options.real ? (process.getgid?.() ?? 0) : (process.getegid?.() ?? 0);

if (positionals.length) {
	const fields = passwd.find(fields => fields[0] == positionals[0] || fields[2] == positionals[0]);
	if (!fields) throw `'${positionals[0]}': no such user`;
	uid = Number(fields[2]);
	gid = Number(fields[3]);
}

const user = nameOf(passwd, uid);
const group = nameOf(groups, gid);

function show(id: number, name: string | undefined): void {
	if (options.name && !name) throw `cannot find name for ID ${id}`;
	console.log(options.name && name ? name : String(id));
}

const shown = (id: number, name: string | undefined) => `${id}${name ? `(${name})` : ''}`;

if (options.user) show(uid, user);
else if (options.group || options.groups) show(gid, group);
else console.log(`uid=${shown(uid, user)} gid=${shown(gid, group)} groups=${shown(gid, group)}`);
