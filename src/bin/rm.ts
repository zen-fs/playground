import * as fs from '@zenfs/core';

if (!process.argv[1]) {
	throw 'No path provided';
}
fs.unlinkSync(process.argv[1]);
