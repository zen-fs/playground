import * as fs from 'fs';

if (!process.argv[1]) {
	throw 'No path provided';
}
process.stdout.write(fs.readFileSync(process.argv[1], 'utf8'));
