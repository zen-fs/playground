import * as fs from 'fs';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		sh: { short: 'b', type: 'boolean', default: false },
		csh: { short: 'c', type: 'boolean', default: false },
		'print-database': { short: 'p', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

const defaults: [string, string][] = [
	['NORMAL', '0'],
	['FILE', '0'],
	['RESET', '0'],
	['DIR', '01;34'],
	['LINK', '01;36'],
	['FIFO', '40;33'],
	['SOCK', '01;35'],
	['BLK', '40;33;01'],
	['CHR', '40;33;01'],
	['ORPHAN', '40;31;01'],
	['EXEC', '01;32'],
	['.tar', '01;31'],
	['.tgz', '01;31'],
	['.zip', '01;31'],
	['.gz', '01;31'],
	['.bz2', '01;31'],
	['.xz', '01;31'],
	['.jpg', '01;35'],
	['.png', '01;35'],
	['.gif', '01;35'],
	['.svg', '01;35'],
	['.mp3', '00;36'],
	['.wav', '00;36'],
	['.mp4', '01;35'],
];

const codes: Record<string, string> = {
	NORMAL: 'no',
	FILE: 'fi',
	RESET: 'rs',
	DIR: 'di',
	LINK: 'ln',
	FIFO: 'pi',
	SOCK: 'so',
	BLK: 'bd',
	CHR: 'cd',
	ORPHAN: 'or',
	EXEC: 'ex',
};

if (options['print-database']) {
	for (const [name, value] of defaults) console.log(`${name} ${value}`);
	process.exit(0);
}

const entries = positionals.length
	? fs
			.readFileSync(positionals[0], 'utf8')
			.split('\n')
			.map(line => line.replace(/#.*/, '').trim())
			.filter(Boolean)
			.map(line => line.split(/\s+/) as [string, string])
	: defaults;

const database = entries.map(([name, value]) => `${codes[name] ?? `*${name}`}=${value}`).join(':') + ':';

console.log(options.csh ? `setenv LS_COLORS '${database}'` : `LS_COLORS='${database}';\nexport LS_COLORS`);
