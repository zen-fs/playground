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

const formatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

const colors = [
	[0o100, 'green'],
	[0o010, 'green'],
	[0o001, 'green'],
	[S_IFDIR, 'blue'],
	[S_IFLNK, 'cyan'],
];

const dir = args.slice(1).filter(arg => !arg.startsWith('-'))[0] || '.';
const longFormat = args.includes('-l');

for (const file of fs.readdirSync(dir)) {
	const stats = fs.statSync(path.join(dir, file));

	let colorize = chalk;
	for (const [mask, color] of colors) {
		if ((stats.mode & mask) == mask) {
			colorize = colorize[color];
		}
	}

	const parts = [
		formatPermissions(stats.mode),
		stats.nlink,
		stats.uid.toString().padStart(4),
		stats.gid.toString().padStart(4),
		formatSize(stats.size),
		formatter.format(stats.mtime).replaceAll(',', ''),
		colorize(file),
	];

	terminal.write(!longFormat ? colorize(file) + ' ' : parts.join(' ') + '\n');
}

// New line at the end of the output
if (!longFormat) {
	terminal.write('\n');
}
