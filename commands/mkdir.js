/// <reference file="./lib.d.ts" >
if (!args[1]) {
	throw 'No path provided';
}
fs.mkdirSync(args[1]);
