import * as fs from 'fs';
import * as path from 'path';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const args = process.argv.slice(1);

const roots: string[] = [];

while (args.length && !args[0].startsWith('-')) roots.push(args.shift()!);

if (!roots.length) roots.push('.');

interface Test {
	(target: string, stats: fs.Stats, depth: number): boolean;
}

const tests: Test[] = [];

let minDepth = 0;
let maxDepth = Infinity;
let zero = false;

function glob(pattern: string, insensitive: boolean): RegExp {
	const source = pattern
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*/g, '[^/]*')
		.replace(/\?/g, '[^/]');
	return new RegExp(`^${source}$`, insensitive ? 'i' : '');
}

const types: Record<string, (stats: fs.Stats) => boolean> = {
	f: stats => stats.isFile(),
	d: stats => stats.isDirectory(),
	l: stats => stats.isSymbolicLink(),
	b: stats => stats.isBlockDevice(),
	c: stats => stats.isCharacterDevice(),
	p: stats => stats.isFIFO(),
	s: stats => stats.isSocket(),
};

const sizeUnits: Record<string, number> = { b: 512, c: 1, k: 1024, M: 1048576, G: 1073741824 };

while (args.length) {
	const expression = args.shift()!;
	const value = () => {
		const next = args.shift();
		if (next === undefined) throw `missing argument to '${expression}'`;
		return next;
	};

	switch (expression) {
		case '-name': {
			const pattern = glob(value(), false);
			tests.push(target => pattern.test(path.basename(target)));
			break;
		}
		case '-iname': {
			const pattern = glob(value(), true);
			tests.push(target => pattern.test(path.basename(target)));
			break;
		}
		case '-path': {
			const pattern = glob(value(), false);
			tests.push(target => pattern.test(target));
			break;
		}
		case '-type': {
			const wanted = value();
			const test = types[wanted];
			if (!test) throw `unknown type '${wanted}'`;
			tests.push((_, stats) => test(stats));
			break;
		}
		case '-maxdepth':
			maxDepth = Number(value());
			break;
		case '-mindepth':
			minDepth = Number(value());
			break;
		case '-empty':
			tests.push((target, stats) => (stats.isDirectory() ? !fs.readdirSync(target).length : !stats.size));
			break;
		case '-size': {
			const text = value();
			const match = /^([+-]?)(\d+)([bckMG]?)$/.exec(text);
			if (!match) throw `invalid -size argument '${text}'`;
			const unit = sizeUnits[match[3] || 'b'];
			const blocks = Number(match[2]);
			tests.push((_, stats) => {
				const count = Math.ceil(stats.size / unit);
				return match[1] == '+' ? count > blocks : match[1] == '-' ? count < blocks : count == blocks;
			});
			break;
		}
		case '-print':
			break;
		case '-print0':
			zero = true;
			break;
		default:
			throw `unknown predicate '${expression}'`;
	}
}

function visit(target: string, depth: number): void {
	let stats;

	try {
		stats = fs.lstatSync(target);
	} catch (error) {
		console.error(`find: '${target}': ${message(error)}`);
		return;
	}

	if (depth >= minDepth && depth <= maxDepth && tests.every(test => test(target, stats, depth))) {
		process.stdout.write(target + (zero ? '\0' : '\n'));
	}

	if (!stats.isDirectory() || depth >= maxDepth) return;

	let entries: string[];

	try {
		entries = fs.readdirSync(target);
	} catch (error) {
		console.error(`find: '${target}': ${message(error)}`);
		return;
	}

	for (const entry of entries) visit(target == '/' ? '/' + entry : `${target}/${entry}`, depth + 1);
}

for (const root of roots) visit(root.length > 1 ? root.replace(/\/+$/, '') : root, 0);
