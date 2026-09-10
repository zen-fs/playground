import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		all: { short: 'a', type: 'boolean', default: false },
		summarize: { short: 's', type: 'boolean', default: false },
		human: { short: 'h', type: 'boolean', default: false },
		total: { short: 'c', type: 'boolean', default: false },
		bytes: { short: 'b', type: 'boolean', default: false },
		'max-depth': { short: 'd', type: 'string' },
	},
	allowPositionals: true,
});

const maxDepth = options.summarize ? 0 : options['max-depth'] === undefined ? Infinity : Number(options['max-depth']);

function human(bytes: number): string {
	const units = ['', 'K', 'M', 'G', 'T'];
	let value = bytes;
	let unit = 0;

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}

	return (!unit ? String(value) : value < 10 ? value.toFixed(1) : String(Math.round(value))) + units[unit];
}

function show(bytes: number, target: string): void {
	console.log(`${options.human ? human(bytes) : options.bytes ? bytes : Math.ceil(bytes / 1024)}\t${target}`);
}

const seen = new Set<number>();

function walk(target: string, depth: number): number {
	const stats = fs.lstatSync(target);

	if (stats.nlink > 1 && !stats.isDirectory()) {
		if (seen.has(stats.ino)) return 0;
		seen.add(stats.ino);
	}

	const own = options.bytes ? stats.size : stats.blocks * 512;

	if (!stats.isDirectory()) {
		if (options.all && depth <= maxDepth) show(own, target);
		return own;
	}

	let total = own;

	for (const entry of fs.readdirSync(target)) {
		try {
			total += walk(path.join(target, entry), depth + 1);
		} catch (error) {
			console.error(`du: ${path.join(target, entry)}: ${message(error)}`);
		}
	}

	if (depth <= maxDepth) show(total, target);

	return total;
}

let grand = 0;

for (const target of positionals.length ? positionals : ['.']) grand += walk(target, 0);

if (options.total) show(grand, 'total');
