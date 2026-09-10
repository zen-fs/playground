import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		'no-symlinks': { short: 's', type: 'boolean', default: false },
		quiet: { short: 'q', type: 'boolean', default: false },
		zero: { short: 'z', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

const end = options.zero ? '\0' : '\n';

let failed = false;

for (const target of positionals) {
	try {
		process.stdout.write((options['no-symlinks'] ? path.resolve(target) : fs.realpathSync(target)) + end);
	} catch (error) {
		failed = true;
		if (!options.quiet) console.error(`realpath: ${target}: ${message(error)}`);
	}
}

if (failed) process.exit(1);
