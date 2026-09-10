import * as fs from 'fs';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		parents: { short: 'p', type: 'boolean', default: false },
		mode: { short: 'm', type: 'string' },
		verbose: { short: 'v', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

const mode = options.mode === undefined ? 0o777 : parseInt(options.mode, 8);

if (Number.isNaN(mode)) throw `invalid mode '${options.mode}'`;

let failed = false;

for (const target of positionals) {
	try {
		if (options.parents && fs.existsSync(target)) continue;
		if (options.verbose) console.log(`created directory '${target}'`);
		fs.mkdirSync(target, { mode, recursive: options.parents });
	} catch (error) {
		failed = true;
		console.error(`mkdir: cannot create directory '${target}': ${message(error)}`);
	}
}

if (failed) process.exit(1);
