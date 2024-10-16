export {};
/// <reference types="./lib.d.ts" />
// @ts-check

// Argument parsing
const positionals = args.filter(arg => !arg.startsWith('-')).slice(1);

if (positionals.length != 2) {
	throw 'Usage: ln [OPTION]... TARGET LINK_NAME';
}

(args.includes('-s') ? fs.symlinkSync : fs.linkSync)(positionals[0], positionals[1]);
