/// <reference types="./lib.d.ts" />
// @ts-check
export {};
if (!args[1]) {
	throw 'No path provided';
}
fs.mkdirSync(args[1]);
