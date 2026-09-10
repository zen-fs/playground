import * as os from 'os';
import { parseArgs } from 'util';

const { values: options } = parseArgs({
	options: {
		short: { short: 's', type: 'boolean', default: false },
		fqdn: { short: 'f', type: 'boolean', default: false },
	},
});

const name = os.hostname();

console.log(options.short ? name.split('.')[0] : name);
