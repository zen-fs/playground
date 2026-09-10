import * as fs from 'fs';
import { parseArgs } from 'util';

const message = (error: unknown) => (Error.isError(error) ? error.message : String(error));

const { values: options, positionals } = parseArgs({
	options: {
		number: { short: 'n', type: 'boolean', default: false },
		'number-nonblank': { short: 'b', type: 'boolean', default: false },
		'show-ends': { short: 'E', type: 'boolean', default: false },
		'show-tabs': { short: 'T', type: 'boolean', default: false },
		'show-all': { short: 'A', type: 'boolean', default: false },
		'squeeze-blank': { short: 's', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

const ends = options['show-ends'] || options['show-all'];
const tabs = options['show-tabs'] || options['show-all'];
const numbered = options.number || options['number-nonblank'];
const plain = !ends && !tabs && !numbered && !options['squeeze-blank'];

const buffer = new Uint8Array(65536);

function drain(fd: number): void {
	for (;;) {
		const length = fs.readSync(fd, buffer);
		if (!length) break;
		fs.writeSync(1, buffer.subarray(0, length));
	}
}

let counter = 0;
let blank = false;

function decorate(text: string): string {
	const lines = text.split('\n');
	const trailing = lines.at(-1) === '';
	if (trailing) lines.pop();

	const out: string[] = [];

	for (let line of lines) {
		if (options['squeeze-blank'] && !line) {
			if (blank) continue;
			blank = true;
		} else blank = false;

		if (tabs) line = line.replaceAll('\t', '^I');
		if (ends) line += '$';
		if (numbered && !(options['number-nonblank'] && !line)) line = `${String(++counter).padStart(6)}\t${line}`;

		out.push(line);
	}

	return out.join('\n') + (trailing ? '\n' : '');
}

let failed = false;

for (const file of positionals.length ? positionals : ['-']) {
	try {
		if (plain) {
			const fd = file == '-' ? 0 : fs.openSync(file, 'r');
			try {
				drain(fd);
			} finally {
				if (fd) fs.closeSync(fd);
			}
			continue;
		}

		if (file == '-') {
			let text = '';
			for (;;) {
				const length = fs.readSync(0, buffer);
				if (!length) break;
				text += new TextDecoder().decode(buffer.subarray(0, length));
			}
			process.stdout.write(decorate(text));
			continue;
		}

		process.stdout.write(decorate(fs.readFileSync(file, 'utf8')));
	} catch (error) {
		failed = true;
		console.error(`cat: ${file}: ${message(error)}`);
	}
}

if (failed) process.exit(1);
