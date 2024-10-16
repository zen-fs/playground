/// <reference types="./lib.d.ts" />
// @ts-check
if (args.length != 3) {
	throw 'Incorrect number of arguments';
}
fs.renameSync(args[1], args[2]);
