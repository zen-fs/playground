import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		count: { short: 'c', type: 'boolean', default: false },
		repeated: { short: 'd', type: 'boolean', default: false },
		unique: { short: 'u', type: 'boolean', default: false },
		'ignore-case': { short: 'i', type: 'boolean', default: false },
		'skip-fields': { short: 'f', type: 'string' },
		'skip-chars': { short: 's', type: 'string' },
	},
	allowPositionals: true,
});

function readAll(fd: number): string {
	const chunks: Uint8Array[] = [];
	const buffer = new Uint8Array(65536);

	for (;;) {
		const length = fs.readSync(fd, buffer);
		if (!length) break;
		chunks.push(buffer.slice(0, length));
	}

	const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const data = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(data);
}

const skipFields = Number(options['skip-fields'] ?? 0);
const skipChars = Number(options['skip-chars'] ?? 0);

function key(line: string): string {
	let rest = line;

	for (let field = 0; field < skipFields; field++) rest = rest.replace(/^\s*\S+/, '');

	rest = rest.slice(skipChars);

	return options['ignore-case'] ? rest.toLowerCase() : rest;
}

const input = positionals[0] && positionals[0] != '-' ? fs.readFileSync(positionals[0], 'utf8') : readAll(0);

const lines = input.split('\n');
if (lines.at(-1) === '') lines.pop();

const output: string[] = [];

for (let i = 0; i < lines.length;) {
	let count = 1;
	while (i + count < lines.length && key(lines[i + count]) == key(lines[i])) count++;

	if (!((options.repeated && count < 2) || (options.unique && count > 1))) {
		output.push(options.count ? `${String(count).padStart(7)} ${lines[i]}` : lines[i]);
	}

	i += count;
}

const text = output.map(line => line + '\n').join('');

if (positionals[1]) fs.writeFileSync(positionals[1], text);
else process.stdout.write(text);
