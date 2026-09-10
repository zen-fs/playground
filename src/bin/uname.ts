import * as os from 'os';
import { parseArgs } from 'util';

const { values: options } = parseArgs({
	options: {
		all: { short: 'a', type: 'boolean', default: false },
		'kernel-name': { short: 's', type: 'boolean', default: false },
		nodename: { short: 'n', type: 'boolean', default: false },
		'kernel-release': { short: 'r', type: 'boolean', default: false },
		'kernel-version': { short: 'v', type: 'boolean', default: false },
		machine: { short: 'm', type: 'boolean', default: false },
		'operating-system': { short: 'o', type: 'boolean', default: false },
	},
});

const parts: string[] = [];

if (options.all || options['kernel-name']) parts.push(os.type());
if (options.all || options.nodename) parts.push(os.hostname());
if (options.all || options['kernel-release']) parts.push(os.release());
if (options.all || options['kernel-version']) parts.push(os.version());
if (options.all || options.machine) parts.push(os.machine());
if (options.all || options['operating-system']) parts.push('ZenFS/Linux');

console.log(parts.length ? parts.join(' ') : os.type());
