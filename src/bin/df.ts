import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		human: { short: 'h', type: 'boolean', default: false },
		inodes: { short: 'i', type: 'boolean', default: false },
		type: { short: 'T', type: 'boolean', default: false },
		all: { short: 'a', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

interface Mount {
	device: string;
	point: string;
	type: string;
}

const mounts: Mount[] = fs
	.readFileSync('/proc/mounts', 'utf8')
	.split('\n')
	.filter(Boolean)
	.map(line => {
		const [device, point, type] = line.split(' ');
		return { device, point, type };
	});

function holding(target: string): Mount {
	const resolved = fs.realpathSync(target);
	let best: Mount | undefined;

	for (const mount of mounts) {
		if (resolved != mount.point && !resolved.startsWith(mount.point == '/' ? '/' : mount.point + '/')) continue;
		if (!best || mount.point.length > best.point.length) best = mount;
	}

	if (!best) throw `no file system holds '${target}'`;
	return best;
}

const selected = positionals.length ? positionals.map(holding) : mounts;

function human(bytes: number): string {
	const units = ['', 'K', 'M', 'G', 'T', 'P'];
	let value = bytes;
	let unit = 0;

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}

	return (!unit ? String(value) : value < 10 ? value.toFixed(1) : String(Math.round(value))) + units[unit];
}

const rows: string[][] = [];

for (const mount of selected) {
	let stats;

	try {
		stats = fs.statfsSync(mount.point);
	} catch {
		continue;
	}

	const total = options.inodes ? stats.files : stats.blocks * stats.bsize;
	const free = options.inodes ? stats.ffree : stats.bfree * stats.bsize;
	const available = options.inodes ? stats.ffree : stats.bavail * stats.bsize;
	const used = total - free;

	if (!total && !options.all) continue;

	const amount = (value: number) => (options.inodes ? String(value) : options.human ? human(value) : String(Math.ceil(value / 1024)));

	rows.push([
		mount.device,
		...(options.type ? [mount.type] : []),
		amount(total),
		amount(used),
		amount(available),
		total ? Math.round((used / total) * 100) + '%' : '-',
		mount.point,
	]);
}

const headers = [
	'Filesystem',
	...(options.type ? ['Type'] : []),
	options.inodes ? 'Inodes' : options.human ? 'Size' : '1K-blocks',
	options.inodes ? 'IUsed' : 'Used',
	options.inodes ? 'IFree' : 'Avail',
	options.inodes ? 'IUse%' : 'Use%',
	'Mounted on',
];

const widths = headers.map((header, column) => Math.max(header.length, ...rows.map(row => row[column].length)));

for (const row of [headers, ...rows]) {
	console.log(
		row
			.map((cell, column) => (column == 0 || column == row.length - 1 ? cell.padEnd(widths[column]) : cell.padStart(widths[column])))
			.join(' ')
			.trimEnd()
	);
}
