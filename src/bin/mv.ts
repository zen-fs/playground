import * as fs from '@zenfs/core';

if (process.argv.length != 3) {
	throw 'Incorrect number of arguments';
}
fs.renameSync(process.argv[1], process.argv[2]);
