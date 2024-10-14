/// <reference file="./lib.d.ts" >
if (!args[1]) {
	throw 'No path provided';
}
terminal.writeln(fs.readFileSync(args[1], 'utf8'));
