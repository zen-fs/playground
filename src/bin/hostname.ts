import * as fs from 'fs';
import { parseArgs } from 'util';

const sysctl = '/proc/sys/kernel/';

const { values: options, positionals } = parseArgs({
	options: {
		short: { short: 's', type: 'boolean', default: false },
		fqdn: { short: 'f', type: 'boolean', default: false },
		domain: { short: 'd', type: 'boolean', default: false },
		file: { short: 'F', type: 'string' },
		boot: { short: 'b', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

const read = (what: string) => fs.readFileSync(sysctl + what, 'utf8').trim();

let name = positionals[0];

if (options.file !== undefined) {
	try {
		name = fs.readFileSync(options.file, 'utf8').trim();
	} catch (error) {
		if (!options.boot) throw error;
	}
}

if (name !== undefined) {
	if (options.boot && read('hostname') !== '(none)') process.exit(0);
	fs.writeFileSync(sysctl + 'hostname', name);
	process.exit(0);
}

if (options.domain) {
	console.log(read('domainname'));
	process.exit(0);
}

const current = read('hostname');

console.log(options.short && !options.fqdn ? current.split('.')[0] : current);
