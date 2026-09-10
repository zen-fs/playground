import type { InspectColor } from 'node:util';
import { parseArgs, styleText } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const { S_IFREG, S_IFDIR, S_IFCHR, S_IFBLK, S_IFIFO, S_IFLNK, S_IFSOCK, S_IFMT } = fs.constants;

const { values: options, positionals: targets } = parseArgs({
	options: {
		long: { short: 'l', type: 'boolean', default: false },
		all: { short: 'a', type: 'boolean', default: false },
		'almost-all': { short: 'A', type: 'boolean', default: false },
		'human-readable': { short: 'h', type: 'boolean', default: false },
		'one-per-line': { short: '1', type: 'boolean', default: false },
		recursive: { short: 'R', type: 'boolean', default: false },
		directory: { short: 'd', type: 'boolean', default: false },
		time: { short: 't', type: 'boolean', default: false },
		size: { short: 'S', type: 'boolean', default: false },
		reverse: { short: 'r', type: 'boolean', default: false },
		classify: { short: 'F', type: 'boolean', default: false },
		inode: { short: 'i', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

function formatPermissions(mode: number) {
	const types: Record<number, string> = {
		[S_IFREG]: '-',
		[S_IFDIR]: 'd',
		[S_IFCHR]: 'c',
		[S_IFBLK]: 'b',
		[S_IFIFO]: 'p',
		[S_IFLNK]: 'l',
		[S_IFSOCK]: 's',
	};

	return (
		(types[mode & S_IFMT] || '?') +
		[
			mode & 0o400 ? 'r' : '-',
			mode & 0o200 ? 'w' : '-',
			mode & 0o100 ? (mode & 0o4000 ? 's' : 'x') : mode & 0o4000 ? 'S' : '-',
			mode & 0o040 ? 'r' : '-',
			mode & 0o020 ? 'w' : '-',
			mode & 0o010 ? (mode & 0o2000 ? 's' : 'x') : mode & 0o2000 ? 'S' : '-',
			mode & 0o004 ? 'r' : '-',
			mode & 0o002 ? 'w' : '-',
			mode & 0o001 ? (mode & 0o1000 ? 't' : 'x') : mode & 0o1000 ? 'T' : '-',
		].join('')
	);
}

function formatSize(size: number) {
	if (!options['human-readable']) return String(size);

	const units = ['', 'K', 'M', 'G', 'T'];
	let index = 0;

	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index++;
	}

	return !index ? String(size) : size < 10 ? size.toFixed(1) + units[index] : Math.round(size) + units[index];
}

/** `LS_COLORS`, as `dircolors` writes it: a `:`-separated list of `key=attributes` */
const database = new Map<string, string>();

for (const entry of (process.env.LS_COLORS ?? '').split(':')) {
	const eq = entry.indexOf('=');
	if (eq > 0) database.set(entry.slice(0, eq), entry.slice(eq + 1));
}

/** What is used when nothing set `LS_COLORS` */
const fallback: Record<number, InspectColor> = {
	[S_IFDIR]: 'blue',
	[S_IFLNK]: 'cyan',
	[S_IFBLK]: 'yellow',
	[S_IFCHR]: 'yellow',
	[S_IFIFO]: 'yellow',
	[S_IFSOCK]: 'magenta',
};

const keys: Record<number, string> = {
	[S_IFDIR]: 'di',
	[S_IFLNK]: 'ln',
	[S_IFIFO]: 'pi',
	[S_IFSOCK]: 'so',
	[S_IFBLK]: 'bd',
	[S_IFCHR]: 'cd',
};

function colorize(text: string, stats: fs.Stats) {
	if (database.size) {
		const type = keys[stats.mode & S_IFMT] ?? (stats.mode & 0o111 ? 'ex' : `*${path.extname(text)}`);
		const attributes = database.get(type) ?? database.get('fi');
		return attributes ? `\x1b[${attributes}m${text}\x1b[0m` : text;
	}

	const color = fallback[stats.mode & S_IFMT];
	if (color) return styleText(color, text);
	return stats.mode & 0o111 ? styleText('green', text) : text;
}

/** The `-F` suffix, which says what a name is without needing color */
function classify(stats: fs.Stats): string {
	if (!options.classify) return '';
	if (stats.isDirectory()) return '/';
	if (stats.isSymbolicLink()) return '@';
	if (stats.isFIFO()) return '|';
	if (stats.isSocket()) return '=';
	return stats.mode & 0o111 ? '*' : '';
}

const formatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

interface Entry {
	name: string;
	path: string;
	stats: fs.Stats;
}

function sort(entries: Entry[]): Entry[] {
	if (options.time) entries.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
	else if (options.size) entries.sort((a, b) => b.stats.size - a.stats.size);
	else entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

	if (options.reverse) entries.reverse();
	return entries;
}

function inodeOf(stats: fs.Stats): string {
	return options.inode ? `${stats.ino} ` : '';
}

function listLong(entries: Entry[]): void {
	const widths = {
		links: Math.max(...entries.map(entry => String(entry.stats.nlink).length), 1),
		uid: Math.max(...entries.map(entry => String(entry.stats.uid).length), 1),
		gid: Math.max(...entries.map(entry => String(entry.stats.gid).length), 1),
		size: Math.max(...entries.map(entry => formatSize(entry.stats.size).length), 1),
	};

	for (const { name, path: full, stats } of entries) {
		const sym = [];

		if (stats.isSymbolicLink()) {
			const target = fs.readlinkSync(full);
			const resolved = path.resolve(path.dirname(full), target);
			sym.push('->', fs.existsSync(resolved) ? colorize(target, fs.statSync(resolved)) : styleText('bgRed', target));
		}

		console.log(
			[
				inodeOf(stats) + formatPermissions(stats.mode),
				String(stats.nlink).padStart(widths.links),
				String(stats.uid).padStart(widths.uid),
				String(stats.gid).padStart(widths.gid),
				formatSize(stats.size).padStart(widths.size),
				formatter.format(stats.mtime).replaceAll(',', ''),
				colorize(name, stats) + classify(stats),
				...sym,
			].join(' ')
		);
	}
}

function listShort(entries: Entry[]): void {
	const cells = entries.map(entry => ({
		plain: inodeOf(entry.stats) + entry.name + classify(entry.stats),
		colored: inodeOf(entry.stats) + colorize(entry.name, entry.stats) + classify(entry.stats),
	}));

	const width = Math.max(...cells.map(cell => cell.plain.length), 1) + 2;
	const perLine = options['one-per-line'] || !process.stdout.isTTY ? 1 : Math.max(1, Math.floor(process.stdout.columns / width));

	for (let i = 0; i < cells.length; i += perLine) {
		const row = cells.slice(i, i + perLine);
		console.log(row.map((cell, column) => (column == row.length - 1 ? cell.colored : cell.colored + ' '.repeat(width - cell.plain.length))).join(''));
	}
}

function read(target: string): Entry[] {
	const names = fs.readdirSync(target);

	if (options.all) names.unshift('.', '..');
	else if (!options['almost-all']) {
		for (let i = names.length - 1; i >= 0; i--) if (names[i].startsWith('.')) names.splice(i, 1);
	}

	return names.map(name => {
		const full = target == '/' ? '/' + name : `${target}/${name}`;
		return { name, path: full, stats: fs.lstatSync(full) };
	});
}

function listTarget(target: string, header: boolean): void {
	const entries = sort(read(target));

	if (header) console.log(`${target}:`);
	if (entries.length) (options.long ? listLong : listShort)(entries);
	if (header) console.log();

	if (!options.recursive) return;

	for (const entry of entries) {
		if (!entry.stats.isDirectory() || entry.name == '.' || entry.name == '..') continue;
		listTarget(entry.path, true);
	}
}

if (!targets.length) targets.push('.');

const files: Entry[] = [];
const directories: string[] = [];

for (const target of targets) {
	const stats = fs.lstatSync(target);
	if (stats.isDirectory() && !options.directory) directories.push(target);
	else files.push({ name: target, path: target, stats });
}

if (files.length) (options.long ? listLong : listShort)(sort(files));

const headers = directories.length > 1 || files.length > 0 || options.recursive;

for (const [index, target] of directories.entries()) {
	if (index && !headers) console.log();
	listTarget(target, headers);
}
