import * as fs from '@zenfs/core';

if (!process.argv[1]) {
	throw 'No path provided';
}
console.log(fs.readFileSync(process.argv[1], 'utf8'));
