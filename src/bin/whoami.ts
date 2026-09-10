import * as fs from 'fs';

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

if (!name) throw `cannot find name for user ID ${uid}`;

console.log(name);
