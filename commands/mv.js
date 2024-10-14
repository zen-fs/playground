/// <reference file="./lib.d.ts" >
if (args.length != 3) {
	throw 'Incorrect number of arguments';
}
fs.renameSync(args[1], args[2]);
