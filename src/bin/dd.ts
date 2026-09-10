import * as fs from 'fs';

const operands = new Map<string, string>();

for (const arg of process.argv.slice(1)) {
	const eq = arg.indexOf('=');
	if (eq < 0) throw `unrecognized operand '${arg}'`;
	operands.set(arg.slice(0, eq), arg.slice(eq + 1));
}

const units: Record<string, number> = { '': 1, c: 1, b: 512, K: 1024, KB: 1000, k: 1024, M: 1048576, MB: 1e6, G: 1073741824, GB: 1e9 };

function size(name: string, fallback: number): number {
	const text = operands.get(name);
	if (text === undefined) return fallback;

	const match = /^(\d+)([a-zA-Z]*)$/.exec(text);
	if (!match || units[match[2]] === undefined) throw `invalid number '${text}'`;

	return Number(match[1]) * units[match[2]];
}

const blockSize = size('bs', 512);
const count = operands.has('count') ? size('count', 0) : Infinity;
const skip = size('skip', 0);
const seek = size('seek', 0);
const conv = (operands.get('conv') ?? '').split(',');

const input = operands.has('if') ? fs.openSync(operands.get('if')!, 'r') : 0;
const output = operands.has('of') ? fs.openSync(operands.get('of')!, conv.includes('notrunc') ? 'r+' : 'w') : 1;

const buffer = new Uint8Array(blockSize);

let read = 0;
let written = 0;
let bytes = 0;

const started = Date.now();

try {
	let position = skip * blockSize;
	let target = seek * blockSize;

	while (read < count) {
		const length = fs.readSync(input, buffer, 0, blockSize, input == 0 ? -1 : position);
		if (!length) break;

		position += length;
		read++;

		fs.writeSync(output, buffer.subarray(0, length), 0, length, output == 1 ? -1 : target);
		target += length;
		written++;
		bytes += length;
	}
} finally {
	if (input != 0) fs.closeSync(input);
	if (output != 1) fs.closeSync(output);
}

if (operands.get('status') != 'none') {
	const elapsed = (Date.now() - started) / 1000;
	console.error(`${read}+0 records in`);
	console.error(`${written}+0 records out`);
	console.error(`${bytes} bytes copied, ${elapsed.toFixed(4)} s, ${(bytes / 1024 / Math.max(elapsed, 1e-4)).toFixed(1)} KB/s`);
}
