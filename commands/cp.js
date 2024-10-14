/// <reference file="./lib.d.ts" >
if (args.length != 3) {
	throw 'Incorrect number of arguments';
}
fs.cpSync(args[1], args[2]);
