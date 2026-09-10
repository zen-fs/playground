import * as fs from 'fs';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		canonicalize: { short: 'f', type: 'boolean', default: false },
		'no-newline': { short: 'n', type: 'boolean', default: false },
		quiet: { short: 'q', type: 'boolean', default: false },
		zero: { short: 'z', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

const end = options.zero ? '\0' : options['no-newline'] ? '' : '\n';

let failed = false;

for (const target of positionals) {
	try {
		process.stdout.write((options.canonicalize ? fs.realpathSync(target) : fs.readlinkSync(target)) + end);
	} catch (error) {
		failed = true;
		if (!options.quiet) console.error(`readlink: ${target}: ${message(error)}`);
	}
}

if (failed) process.exit(1);
