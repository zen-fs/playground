import * as path from 'path';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		multiple: { short: 'a', type: 'boolean', default: false },
		suffix: { short: 's', type: 'string' },
		zero: { short: 'z', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

const multiple = options.multiple || options.suffix !== undefined;

if (!multiple && positionals.length > 2) throw `extra operand '${positionals[2]}'`;

const names = multiple ? positionals : positionals.slice(0, 1);
const suffix = options.suffix ?? (multiple ? undefined : positionals[1]);

for (const name of names) {
	const base = path.basename(name);
	const trimmed = suffix && base != suffix && base.endsWith(suffix) ? base.slice(0, -suffix.length) : base;
	process.stdout.write(trimmed + (options.zero ? '\0' : '\n'));
}
