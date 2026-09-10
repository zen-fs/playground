import * as os from 'os';
import { parseArgs } from 'util';

const { values: options } = parseArgs({
	options: {
		pretty: { short: 'p', type: 'boolean', default: false },
		since: { short: 's', type: 'boolean', default: false },
	},
});

const up = Math.floor(os.uptime());

const pad = (value: number) => String(value).padStart(2, '0');

function pretty(seconds: number): string {
	const parts: string[] = [];
	let left = seconds;

	for (const [size, unit] of [
		[86400, 'day'],
		[3600, 'hour'],
		[60, 'minute'],
	] as const) {
		const count = Math.floor(left / size);
		left -= count * size;
		if (count) parts.push(`${count} ${unit}${count == 1 ? '' : 's'}`);
	}

	if (!parts.length) parts.push(`${left} second${left == 1 ? '' : 's'}`);

	return 'up ' + parts.join(', ');
}

const booted = new Date(Date.now() - up * 1000);

if (options.since)
	console.log(`${booted.getFullYear()}-${pad(booted.getMonth() + 1)}-${pad(booted.getDate())} ${pad(booted.getHours())}:${pad(booted.getMinutes())}:${pad(booted.getSeconds())}`);
else if (options.pretty) console.log(pretty(up));
else {
	const now = new Date();
	console.log(` ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pretty(up)},  1 user`);
}
