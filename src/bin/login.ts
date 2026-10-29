import { execFileSync, type ExecFileSyncOptions, type SpawnSyncOptions } from 'child_process';
import * as fs from 'fs';
import { basename } from 'path';
import { parseArgs } from 'util';

const {
	positionals: [username],
} = parseArgs({
	// There are no passwords to check yet, so `-f` is accepted and changes nothing
	options: { force: { short: 'f', type: 'boolean', default: false } },
	allowPositionals: true,
});

if (!username) throw 'usage: login [-f] username';

let entry: string[] | undefined;

try {
	entry = fs
		.readFileSync('/etc/passwd', 'utf8')
		.split('\n')
		.map(line => line.split(':'))
		.find(fields => fields[0] == username);
} catch {
	entry = undefined;
}

if (!entry) throw 'Login incorrect';

const [, , uid, , , home] = entry;
const shell = entry[6] || '/bin/sh';

const env: Record<string, string> = {
	HOME: home,
	USER: username,
	LOGNAME: username,
	SHELL: shell,
	PATH: Number(uid) == 0 ? '/sbin:/bin' : '/bin',
};

if (process.env.TERM) env.TERM = process.env.TERM;

try {
	process.chdir(home);
} catch {
	console.log('No directory, logging in with HOME=/');
	env.HOME = '/';
	process.chdir('/');
}

const options: ExecFileSyncOptions & SpawnSyncOptions = { argv0: '-' + basename(shell), env, stdio: 'inherit' };

try {
	execFileSync(shell, [], options);
} catch (error) {
	const status = (error as { status?: number }).status;
	process.exit(typeof status == 'number' ? status : 1);
}
