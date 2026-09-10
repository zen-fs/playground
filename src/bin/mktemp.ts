import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseArgs } from 'util';

const { values: options, positionals } = parseArgs({
	options: {
		directory: { short: 'd', type: 'boolean', default: false },
		'dry-run': { short: 'u', type: 'boolean', default: false },
		quiet: { short: 'q', type: 'boolean', default: false },
		tmpdir: { short: 'p', type: 'string' },
		t: { short: 't', type: 'boolean', default: false },
	},
	allowPositionals: true,
});

const template = positionals[0] ?? 'tmp.XXXXXXXXXX';

if (!/XXX$/.test(template)) throw `too few X's in template '${template}'`;

const inTmpdir = !positionals.length || options.tmpdir !== undefined || options.t;
const directory = inTmpdir ? (options.tmpdir ?? os.tmpdir()) : path.dirname(template);
const name = path.basename(template);

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function candidate(): string {
	const suffix = /X+$/.exec(name)![0];
	const random = Array.from(crypto.getRandomValues(new Uint8Array(suffix.length)), byte => alphabet[byte % alphabet.length]).join('');
	return path.join(directory, name.slice(0, -suffix.length) + random);
}

for (let attempt = 0; attempt < 100; attempt++) {
	const target = candidate();
	if (fs.existsSync(target)) continue;

	if (!options['dry-run']) {
		if (options.directory) fs.mkdirSync(target, 0o700);
		else fs.writeFileSync(target, '', { mode: 0o600 });
	}

	console.log(target);
	process.exit(0);
}

if (!options.quiet) console.error('mktemp: failed to create a unique name');
process.exit(1);
