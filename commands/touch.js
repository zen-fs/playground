/// <reference file="./lib.d.ts" >
if (!args[1]) {
	throw 'No path provided';
}
if (fs.existsSync(args[1])) {
	fs.utimesSync(args[1], Date.now(), Date.now());
} else {
	fs.writeFileSync(args[1], '');
}
