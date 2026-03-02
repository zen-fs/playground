import * as fs from '@zenfs/core';

if (process.argv.length != 3) {
	throw 'Incorrect number of arguments';
}
fs.cpSync(process.argv[1], process.argv[2]);
