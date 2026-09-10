import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		date: { short: 'd', type: 'string' },
		reference: { short: 'r', type: 'string' },
		utc: { short: 'u', type: 'boolean', default: false },
		'rfc-email': { short: 'R', type: 'boolean', default: false },
		'iso-8601': { short: 'I', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

function parse(text: string): Date {
	if (text == 'now') return new Date();
	if (text.startsWith('@')) return new Date(Number(text.slice(1)) * 1000);

	const parsed = new Date(text);
	if (isNaN(parsed.getTime())) throw `invalid date '${text}'`;
	return parsed;
}

const when = options.reference !== undefined ? fs.statSync(options.reference).mtime : options.date !== undefined ? parse(options.date) : new Date();

const utc = options.utc;

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const year = () => (utc ? when.getUTCFullYear() : when.getFullYear());
const month = () => (utc ? when.getUTCMonth() : when.getMonth());
const day = () => (utc ? when.getUTCDate() : when.getDate());
const weekday = () => (utc ? when.getUTCDay() : when.getDay());
const hours = () => (utc ? when.getUTCHours() : when.getHours());
const minutes = () => (utc ? when.getUTCMinutes() : when.getMinutes());
const seconds = () => (utc ? when.getUTCSeconds() : when.getSeconds());

function offset(): string {
	if (utc) return '+0000';
	const total = -when.getTimezoneOffset();
	return (total < 0 ? '-' : '+') + pad(Math.floor(Math.abs(total) / 60)) + pad(Math.abs(total) % 60);
}

function zone(): string {
	if (utc) return 'UTC';
	return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(when).find(part => part.type == 'timeZoneName')?.value ?? '';
}

const codes: Record<string, () => string> = {
	'%': () => '%',
	a: () => days[weekday()].slice(0, 3),
	A: () => days[weekday()],
	b: () => months[month()].slice(0, 3),
	B: () => months[month()],
	C: () => pad(Math.floor(year() / 100)),
	d: () => pad(day()),
	D: () => `${pad(month() + 1)}/${pad(day())}/${pad(year() % 100)}`,
	e: () => String(day()).padStart(2),
	F: () => `${pad(year(), 4)}-${pad(month() + 1)}-${pad(day())}`,
	H: () => pad(hours()),
	I: () => pad(hours() % 12 || 12),
	j: () => pad((Date.UTC(year(), month(), day()) - Date.UTC(year(), 0, 0)) / 86400000, 3),
	m: () => pad(month() + 1),
	M: () => pad(minutes()),
	n: () => '\n',
	N: () => pad(when.getMilliseconds() * 1e6, 9),
	p: () => (hours() < 12 ? 'AM' : 'PM'),
	R: () => `${pad(hours())}:${pad(minutes())}`,
	s: () => String(Math.floor(when.getTime() / 1000)),
	S: () => pad(seconds()),
	t: () => '\t',
	T: () => `${pad(hours())}:${pad(minutes())}:${pad(seconds())}`,
	u: () => String(weekday() || 7),
	w: () => String(weekday()),
	y: () => pad(year() % 100),
	Y: () => String(year()),
	z: offset,
	Z: zone,
};

function strftime(format: string): string {
	return format.replace(/%(.)/g, (match, code: string) => codes[code]?.() ?? match);
}

if (positionals.length && !positionals[0].startsWith('+')) throw `invalid date '${positionals[0]}'`;

if (positionals.length) console.log(strftime(positionals[0].slice(1)));
else if (options['rfc-email']) console.log(strftime('%a, %d %b %Y %H:%M:%S %z'));
else if (options['iso-8601']) console.log(strftime('%F'));
else console.log(strftime('%a %b %e %H:%M:%S %Z %Y'));
