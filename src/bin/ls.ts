import type { InspectColor } from 'node:util';
import { parseArgs, styleText } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const { S_IFREG, S_IFDIR, S_IFCHR, S_IFBLK, S_IFIFO, S_IFLNK, S_IFSOCK, S_IFMT } = fs.constants;

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
	const units = ['', 'K', 'M', 'G', 'T'];
	let index = 0;

	// Handle sizes greater than 1024
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index++;
	}

	return ((!index ? size : size.toFixed(1).slice(0, 3)) + units[index]).padStart(4);
}

const colors: Record<number, InspectColor> = {
	[S_IFDIR]: 'blue',
	[S_IFLNK]: 'cyan',
	[S_IFBLK]: 'yellow',
	[S_IFCHR]: 'yellow',
	[S_IFIFO]: 'yellow',
	[S_IFSOCK]: 'magenta',
};

function colorize(text: string, stats: fs.Stats) {
	const color = colors[stats.mode & S_IFMT];
	if (color) return styleText(color, text);
	return stats.mode & 0o111 ? styleText('green', text) : text;
}

const formatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

function listTarget(target: string, long: boolean) {
	const isDir = fs.statSync(target).isDirectory();
	const files = isDir ? fs.readdirSync(target) : [path.basename(target)];

	if (!isDir) {
		target = path.dirname(target);
	}

	const maxLength = files.reduce((max, file) => Math.max(max, file.length), 0);

	const numColumns = Math.floor(process.stdout.columns / (maxLength + 1));
	const columnLengths = new Array(numColumns).fill(0);
	const columnInfo: Record<string, [number, number]> = {};

	if (!long) {
		for (const file of files) {
			const i = files.indexOf(file) % numColumns;
			columnInfo[file] = [i, file.length];
			columnLengths[i] = Math.max(columnLengths[i], file.length + 3);
		}
	}

	for (const file of files) {
		const filePath = path.join(target, file);
		const stats = fs.lstatSync(filePath);

		if (!long) {
			const [i, length] = columnInfo[file];
			const colored = colorize(file, stats);
			process.stdout.write(colored.padEnd(colored.length - length + columnLengths[i]));
			if (i == numColumns - 1) console.log();
			continue;
		}

		const sym = [];
		if (stats.isSymbolicLink()) {
			const linkTarget = fs.readlinkSync(filePath, 'utf-8');
			const resolved = path.resolve(path.dirname(filePath), linkTarget);
			sym.push('->', fs.existsSync(resolved) ? colorize(linkTarget, fs.statSync(resolved)) : styleText('bgRed', linkTarget));
		}

		const parts = [
			formatPermissions(stats.mode),
			stats.nlink,
			stats.uid.toString().padStart(4),
			stats.gid.toString().padStart(4),
			formatSize(stats.size),
			formatter.format(stats.mtime).replaceAll(',', ''),
			colorize(file, stats),
			...sym,
		];

		console.log(parts.join(' '));
	}

	// New line at the end of the output
	if (!long) console.log();
}

const { values: options, positionals: targets } = parseArgs({
	options: {
		long: { short: 'l', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (!targets.length) targets.push('.');

for (const target of targets) {
	if (targets.length > 1) console.log(`${target}:`);
	listTarget(target, options.long);
	if (targets.length > 1) console.log();
}
