import * as fs from 'fs';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));
const code = (error: unknown) => (error as { code?: string }).code;

const { values: options, positionals } = parseArgs({
	options: {
		recursive: { short: 'r', type: 'boolean', default: false },
		force: { short: 'f', type: 'boolean', default: false },
		dir: { short: 'd', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length && !options.force) throw 'missing operand';

let failed = false;

for (const target of positionals) {
	try {
		const stats = fs.lstatSync(target);

		if (stats.isDirectory() && !options.recursive && !options.dir) throw 'is a directory';

		if (options.verbose) console.log(`removed '${target}'`);

		if (stats.isDirectory() && !options.recursive) fs.rmdirSync(target);
		else fs.rmSync(target, { recursive: options.recursive, force: options.force });
	} catch (error) {
		if (options.force && code(error) == 'ENOENT') continue;
		failed = true;
		console.error(`rm: cannot remove '${target}': ${message(error)}`);
	}
}

if (failed) process.exit(1);
