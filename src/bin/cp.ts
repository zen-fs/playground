import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		recursive: { short: 'r', type: 'boolean', default: false },
		archive: { short: 'a', type: 'boolean', default: false },
		force: { short: 'f', type: 'boolean', default: false },
		'no-clobber': { short: 'n', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
		preserve: { short: 'p', type: 'boolean', default: false },
		'no-dereference': { short: 'd', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (positionals.length < 2) throw 'missing destination file operand';

const recursive = options.recursive || options.archive;
const preserve = options.preserve || options.archive;
const links = options['no-dereference'] || options.archive;

const destination = positionals.pop()!;
const intoDirectory = fs.existsSync(destination) && fs.statSync(destination).isDirectory();

if (positionals.length > 1 && !intoDirectory) throw `target '${destination}' is not a directory`;

function copy(from: string, to: string): void {
	const stats = fs.lstatSync(from);

	if (fs.existsSync(to)) {
		if (options['no-clobber']) return;
		if (options.force && !fs.lstatSync(to).isDirectory()) fs.unlinkSync(to);
	}

	if (options.verbose) console.log(`'${from}' -> '${to}'`);

	if (stats.isSymbolicLink() && links) {
		fs.symlinkSync(fs.readlinkSync(from), to);
		return;
	}

	if (stats.isDirectory()) {
		if (!recursive) throw `-r not specified; omitting directory '${from}'`;
		if (!fs.existsSync(to)) fs.mkdirSync(to, stats.mode & 0o7777);
		for (const entry of fs.readdirSync(from)) copy(path.join(from, entry), path.join(to, entry));
	} else {
		fs.writeFileSync(to, fs.readFileSync(from), { mode: stats.mode & 0o7777 });
	}

	if (!preserve) return;
	fs.utimesSync(to, stats.atime, stats.mtime);
	fs.chownSync(to, stats.uid, stats.gid);
}

let failed = false;

for (const source of positionals) {
	const target = intoDirectory ? path.join(destination, path.basename(source)) : destination;

	try {
		copy(source, target);
	} catch (error) {
		failed = true;
		console.error(`cp: ${message(error)}`);
	}
}

if (failed) process.exit(1);
