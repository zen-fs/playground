import * as fs from 'fs';

if (!process.argv[1]) {
	throw 'No path provided';
}
console.log(fs.readFileSync(process.argv[1], 'utf8'));
