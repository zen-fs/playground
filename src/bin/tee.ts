import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		append: { short: 'a', type: 'boolean', default: false },
		'ignore-interrupts': { short: 'i', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

if (options['ignore-interrupts']) process.on('SIGINT', () => {});

const outputs = positionals.map(file => fs.openSync(file, options.append ? 'a' : 'w'));

const buffer = new Uint8Array(65536);

try {
	for (;;) {
		const length = fs.readSync(0, buffer);
		if (!length) break;

		const chunk = buffer.subarray(0, length);
		fs.writeSync(1, chunk);
		for (const fd of outputs) fs.writeSync(fd, chunk);
	}
} finally {
	for (const fd of outputs) fs.closeSync(fd);
}
