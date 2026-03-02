import { join } from '@zenfs/core/path';
import { existsSync } from '@zenfs/core';

export default async function main(_name: string, ...args: string[]) {
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
		return await exec(file, args, env);
	}

	for (const [key, value] of Object.entries(env)) {
		terminal.writeln(`${key}=${value}`);
	}
}
