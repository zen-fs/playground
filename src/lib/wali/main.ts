import { ready } from '@zenfs/linux/uapi/base';
import { close, fstat, open, read, write } from '@zenfs/linux/uapi/fs';
import { exit } from '@zenfs/linux/uapi/process';
import { run } from '@zenfs/linux/uapi/wali';

function fail(message: string): never {
	write(2, new TextEncoder().encode(`wali: ${message}\n`));
	exit(1);
}

const init = await ready;

const program = init.exe == init.interpreter ? init.argv[1] : init.exe;

if (!program) fail('no program to run');

let data: Uint8Array<ArrayBuffer>;

const fd = open(program, 0);

try {
	data = new Uint8Array(fstat(fd).size);
	for (let offset = 0; offset < data.byteLength;) {
		const length = read(fd, data.subarray(offset));
		if (!length) break;
		offset += length;
	}
} finally {
	close(fd);
}

try {
	await run(data);
} catch (e) {
	fail(String(e));
}

exit(0);
