import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));
const code = (error: unknown) => (error as { code?: string }).code;

const { values: options, positionals } = parseArgs({
	options: {
		parents: { short: 'p', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
		'ignore-fail-on-non-empty': { type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing operand';

let failed = false;

function remove(target: string): boolean {
	try {
		if (options.verbose) console.log(`rmdir: removing directory, '${target}'`);
		fs.rmdirSync(target);
		return true;
	} catch (error) {
		if (options['ignore-fail-on-non-empty'] && code(error) == 'ENOTEMPTY') return false;
		failed = true;
		console.error(`rmdir: failed to remove '${target}': ${message(error)}`);
		return false;
	}
}

for (const target of positionals) {
	if (!remove(target)) continue;
	if (!options.parents) continue;

	for (let parent = path.dirname(target); parent != '.' && parent != '/'; parent = path.dirname(parent)) {
		if (!remove(parent)) break;
	}
}

if (failed) process.exit(1);
