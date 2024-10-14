/// <reference file="./lib.d.ts" >
const { S_IFREG, S_IFDIR, S_IFCHR, S_IFBLK, S_IFIFO, S_IFLNK, S_IFSOCK, S_IFMT } = fs.constants;

function formatPermissions(mode) {
	const types = {
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

function formatSize(size) {
	const units = ['', 'K', 'M', 'G', 'T'];
	let index = 0;

	// Handle sizes greater than 1024
	while (size >= 1024 && index < units.length - 1) {
		size /= 1024;
		index++;
	}

	return ((!index ? size : size.toFixed(1).slice(0, 3)) + units[index]).padStart(4);
}

const colors = [
	[0o100, 'green'],
	[0o010, 'green'],
	[0o001, 'green'],
	[S_IFDIR, 'blue'],
	[S_IFLNK, 'cyan'],
];

function colorize(text, stats) {
	let colorize = chalk;
	for (const [mask, color] of colors) {
		if ((stats.mode & mask) == mask) {
			colorize = utilium.getByString(colorize, color);
		}
	}
	return colorize(text);
}

const formatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

const shortFormat = !args.includes('-l');

let target = args.slice(1).filter(arg => !arg.startsWith('-'))[0] || '.';

const isDir = fs.statSync(target).isDirectory();
const files = isDir ? fs.readdirSync(target) : [path.basename(target)];

if (!isDir) {
	target = path.dirname(target);
}

const maxLength = files.reduce((max, file) => Math.max(max, file.length), 0);

const numColumns = Math.floor(terminal.cols / (maxLength + 1));
const columnLengths = new Array(numColumns).fill(0);
const columnInfo = {};

if (shortFormat) {
	for (const file of files) {
		const i = files.indexOf(file) % numColumns;
		columnInfo[file] = [i, file.length];
		columnLengths[i] = Math.max(columnLengths[i], file.length + 3);
	}
}

for (const file of files) {
	const stats = fs.lstatSync(path.join(target, file));

	if (shortFormat) {
		const [i, length] = columnInfo[file];
		const colored = colorize(file, stats);
		terminal.write(colored.padEnd(colored.length - length + columnLengths[i]));
		if (i == numColumns - 1) {
			terminal.write('\n');
		}
		continue;
	}

	let sym = [];
	if (stats.isSymbolicLink()) {
		const linkTarget = fs.readlinkSync(path.join(target, file));
		sym.push('->', fs.existsSync(linkTarget) ? linkTarget : chalk.bgRed(linkTarget));
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

	terminal.writeln(parts.join(' '));
}

// New line at the end of the output
if (shortFormat) {
	terminal.write('\n');
}
