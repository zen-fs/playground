/// <reference types="./lib.d.ts" />
// @ts-check
export {};

if (!args[1]) {
	throw 'No path provided';
}
terminal.writeln(fs.readFileSync(args[1], 'utf8'));
