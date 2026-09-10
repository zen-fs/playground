import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		size: { short: 's', type: 'string' },
		reference: { short: 'r', type: 'string' },
		'no-create': { short: 'c', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';
if (options.size === undefined && options.reference === undefined) throw 'you must specify either --size or --reference';

const units: Record<string, number> = { '': 1, K: 1024, KB: 1000, M: 1048576, MB: 1e6, G: 1073741824, GB: 1e9 };

function parseSize(text: string): { sign: string; bytes: number } {
	const match = /^([+-<>/%]?)(\d+)([KMG]B?)?$/.exec(text);
	if (!match) throw `invalid number '${text}'`;
	return { sign: match[1], bytes: Number(match[2]) * units[match[3] ?? ''] };
}

const reference = options.reference === undefined ? undefined : fs.statSync(options.reference).size;
const size = options.size === undefined ? undefined : parseSize(options.size);

function target(current: number): number {
	const base = reference ?? current;
	if (!size) return base;

	switch (size.sign) {
		case '+':
			return base + size.bytes;
		case '-':
			return Math.max(0, base - size.bytes);
		case '<':
			return Math.min(base, size.bytes);
		case '>':
			return Math.max(base, size.bytes);
		default:
			return size.bytes;
	}
}

for (const file of positionals) {
	let current = 0;

	try {
		current = fs.statSync(file).size;
	} catch {
		if (options['no-create']) continue;
		fs.writeFileSync(file, '');
	}

	fs.truncateSync(file, target(current));
}
