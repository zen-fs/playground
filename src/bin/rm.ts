import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals: args } = parseArgs({
	options: {
		recursive: { short: 'r', type: 'boolean', default: false },
		force: { short: 'f', type: 'boolean', default: false },
	},
});

if (!args.length) throw 'no operand';

for (const arg of args)
	try {
		fs.rmSync(arg, options);
	} catch (e) {
		console.error(e);
	}
