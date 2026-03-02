import * as fs from '@zenfs/core';

if (!process.argv[1]) {
	throw 'No path provided';
}
if (fs.existsSync(process.argv[1])) {
	fs.utimesSync(process.argv[1], Date.now(), Date.now());
} else {
	fs.writeFileSync(process.argv[1], '');
}
