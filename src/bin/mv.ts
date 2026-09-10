import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));
const code = (error: unknown) => (error as { code?: string }).code;

const { values: options, positionals } = parseArgs({
	options: {
		force: { short: 'f', type: 'boolean', default: false },
		'no-clobber': { short: 'n', type: 'boolean', default: false },
		verbose: { short: 'v', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (positionals.length < 2) throw 'missing destination file operand';

const destination = positionals.pop()!;
const intoDirectory = fs.existsSync(destination) && fs.statSync(destination).isDirectory();

if (positionals.length > 1 && !intoDirectory) throw `target '${destination}' is not a directory`;

/** What `mv` falls back to across mounts, where `rename` can't move an inode */
function relocate(from: string, to: string): void {
	const stats = fs.lstatSync(from);

	if (stats.isDirectory()) {
		fs.mkdirSync(to, stats.mode & 0o7777);
		for (const entry of fs.readdirSync(from)) relocate(path.join(from, entry), path.join(to, entry));
		fs.rmdirSync(from);
		return;
	}

	if (stats.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
	else fs.writeFileSync(to, fs.readFileSync(from), { mode: stats.mode & 0o7777 });

	fs.unlinkSync(from);
}

let failed = false;

for (const source of positionals) {
	const target = intoDirectory ? path.join(destination, path.basename(source)) : destination;

	try {
		if (fs.existsSync(target)) {
			if (options['no-clobber']) continue;
			if (options.force) fs.rmSync(target, { recursive: true, force: true });
		}

		if (options.verbose) console.log(`renamed '${source}' -> '${target}'`);

		try {
			fs.renameSync(source, target);
		} catch (error) {
			if (code(error) != 'EXDEV') throw error;
			relocate(source, target);
		}
	} catch (error) {
		failed = true;
		console.error(`mv: cannot move '${source}' to '${target}': ${message(error)}`);
	}
}

if (failed) process.exit(1);
