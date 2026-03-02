import * as fs from '@zenfs/core';

if (!process.argv[1]) {
	throw 'No path provided';
}
fs.mkdirSync(process.argv[1]);
