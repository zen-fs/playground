import * as fs from 'fs';
import * as os from 'os';

const uid = process.geteuid?.() ?? 0;

let name: string | undefined;

try {
	name = fs
		.readFileSync('/etc/passwd', 'utf8')
		.split('\n')
		.map(line => line.split(':'))
		.find(fields => Number(fields[2]) == uid)?.[0];
} catch {
	name = undefined;
}

let line: string;

try {
	line = fs.readlinkSync('/proc/self/fd/0').replace(/^\/dev\//, '');
} catch {
	line = '-';
}

const pad = (value: number) => String(value).padStart(2, '0');
const booted = new Date(Date.now() - os.uptime() * 1000);
const when = `${booted.getFullYear()}-${pad(booted.getMonth() + 1)}-${pad(booted.getDate())} ${pad(booted.getHours())}:${pad(booted.getMinutes())}`;

console.log(`${(name ?? String(uid)).padEnd(8)} ${line.padEnd(12)} ${when}`);
