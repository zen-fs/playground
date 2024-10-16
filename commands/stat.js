export {};
const { S_IFREG, S_IFDIR, S_IFCHR, S_IFBLK, S_IFIFO, S_IFLNK, S_IFSOCK } = fs.constants;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	timeZoneName: 'shortOffset',
});

function formatDate(date) {
	return dateFormatter.format(date);
}

function formatPermissions(mode) {
	const fileType = mode & fs.constants.S_IFMT;

	const types = {
		[S_IFREG]: '-',
		[S_IFDIR]: 'd',
		[S_IFCHR]: 'c',
		[S_IFBLK]: 'b',
		[S_IFIFO]: 'p',
		[S_IFLNK]: 'l',
		[S_IFSOCK]: 's',
	};

	const type = types[fileType] || '?'; // Get file type

	const symbols = [
		mode & 0o400 ? 'r' : '-',
		mode & 0o200 ? 'w' : '-',
		mode & 0o100 ? (mode & 0o4000 ? 's' : 'x') : mode & 0o4000 ? 'S' : '-',
		mode & 0o040 ? 'r' : '-',
		mode & 0o020 ? 'w' : '-',
		mode & 0o010 ? (mode & 0o2000 ? 's' : 'x') : mode & 0o2000 ? 'S' : '-',
		mode & 0o004 ? 'r' : '-',
		mode & 0o002 ? 'w' : '-',
		mode & 0o001 ? (mode & 0o1000 ? 't' : 'x') : mode & 0o1000 ? 'T' : '-',
	].join('');

	return `${type}${symbols}`;
}

const types = {
	[S_IFREG]: 'regular file',
	[S_IFDIR]: 'directory',
	[S_IFCHR]: 'character special file',
	[S_IFBLK]: 'block special file',
	[S_IFIFO]: 'FIFO (named pipe)',
	[S_IFLNK]: 'symbolic link',
	[S_IFSOCK]: 'socket',
};

const filePath = args[1] || path.resolve('.') || '/';

const stats = fs.lstatSync(filePath);

// Write the output to the terminal
terminal.write(`
  File: ${chalk.blue(filePath)}
  Size: ${chalk.green(stats.size)}\tBlocks: ${chalk.green(stats.blocks)}\tIO Block: ${chalk.green(stats.blksize)}\t${chalk.yellow(types[stats.mode & fs.constants.S_IFMT] || 'unknown')}
Device: ${chalk.cyan(stats.dev.toString(16))}\tInode: ${chalk.cyan(stats.ino)}\tLinks: ${chalk.cyan(stats.nlink)}
Access: (${chalk.yellow((stats.mode & 0o777).toString(8))}/${chalk.yellow(formatPermissions(stats.mode))})  Uid: (${chalk.green(stats.uid)})   Gid: (${chalk.green(stats.gid)})
Access: ${chalk.magenta(formatDate(stats.atime))}
Modify: ${chalk.magenta(formatDate(stats.mtime))}
Change: ${chalk.magenta(formatDate(stats.ctime))}
Birth : ${chalk.magenta(formatDate(stats.birthtime))}
`);
