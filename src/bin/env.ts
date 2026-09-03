import { join } from 'path';
import { existsSync } from 'fs';
import { execFileSync } from 'child_process';

const args = process.argv.slice(1);

const pattern = /^([\w\d_]+)=(.*)$/i;
let match: RegExpExecArray | null;

const env = { ...process.env };

while ((match = pattern.exec(args[0]))) {
	args.shift();
	const [, key, value] = match;
	env[key] = value;
}

if (args.length) {
	let file;
	const command = args.shift()!;
	for (const dir of (process.env.PATH ||= '/bin').split(':')) {
		const p = join(dir, command);
		if (existsSync(p)) file = p;
	}
	if (!file) throw 'Unknown command: ' + command;
	execFileSync(file, args, { env });
	process.exit(0);
}

for (const [key, value] of Object.entries(env)) {
	console.log(`${key}=${value}`);
}
