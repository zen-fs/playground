import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		symbolic: { short: 's', type: 'boolean', default: false },
		force: { short: 'f', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
		relative: { short: 'r', type: 'boolean', default: false },
		'no-dereference': { short: 'n', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!positionals.length) throw 'missing file operand';

const link = (target: string, name: string) => (options.symbolic ? fs.symlinkSync(target, name) : fs.linkSync(target, name));

if (positionals.length == 1) {
	const target = positionals[0];
	const name = path.basename(target);
	if (options.verbose) console.log(`'${name}' -> '${target}'`);
	link(target, name);
	process.exit(0);
}

const destination = positionals.pop()!;
const intoDirectory = fs.existsSync(destination) && fs.statSync(destination).isDirectory() && !options['no-dereference'];

if (positionals.length > 1 && !intoDirectory) throw `target '${destination}' is not a directory`;

let failed = false;

for (const target of positionals) {
	const name = intoDirectory ? path.join(destination, path.basename(target)) : destination;

	try {
		if (options.force && fs.existsSync(name)) fs.unlinkSync(name);

		const from = options.relative && options.symbolic ? path.relative(path.dirname(path.resolve(name)), path.resolve(target)) : target;

		if (options.verbose) console.log(`'${name}' -> '${from}'`);
		link(from, name);
	} catch (error) {
		failed = true;
		console.error(`ln: failed to create link '${name}': ${message(error)}`);
	}
}

if (failed) process.exit(1);
