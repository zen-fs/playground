import * as fs from 'fs';

if (!process.argv[1]) {
	throw 'No path provided';
}
fs.unlinkSync(process.argv[1]);
