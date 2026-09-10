import * as fs from 'fs';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		'no-create': { short: 'c', type: 'boolean', default: false },
		date: { short: 'd', type: 'string' },
		reference: { short: 'r', type: 'string' },
		access: { short: 'a', type: 'boolean', default: false },
		modify: { short: 'm', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

function when(): Date {
	if (options.reference !== undefined) return fs.statSync(options.reference).mtime;
	if (options.date === undefined) return new Date();

	const parsed = options.date.startsWith('@') ? new Date(Number(options.date.slice(1)) * 1000) : new Date(options.date);
	if (isNaN(parsed.getTime())) throw `invalid date format '${options.date}'`;
	return parsed;
}

const stamp = when();
const both = options.access == options.modify;

let failed = false;

for (const target of positionals) {
	try {
		if (!fs.existsSync(target)) {
			if (options['no-create']) continue;
			fs.writeFileSync(target, '');
		}

		const stats = fs.statSync(target);
		fs.utimesSync(target, both || options.access ? stamp : stats.atime, both || options.modify ? stamp : stats.mtime);
	} catch (error) {
		failed = true;
		console.error(`touch: cannot touch '${target}': ${message(error)}`);
	}
}

if (failed) process.exit(1);
