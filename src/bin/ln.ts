import * as fs from '@zenfs/core';

// Argument parsing
const positionals = process.argv.filter(arg => !arg.startsWith('-')).slice(1);

if (positionals.length != 2) {
	throw 'Usage: ln [OPTION]... TARGET LINK_NAME';
}

(process.argv.includes('-s') ? fs.symlinkSync : fs.linkSync)(positionals[0], positionals[1]);
