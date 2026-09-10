import * as path from 'path';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		zero: { short: 'z', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

for (const name of positionals) process.stdout.write(path.dirname(name) + (options.zero ? '\0' : '\n'));
