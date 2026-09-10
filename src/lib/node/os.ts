import { getgid, getuid, uname } from '@zenfs/linux/uapi/process';
import { readFileSync } from './fs.js';
import { process } from './process.js';

export const EOL = '\n';

export function type(): string {
	return uname().sysname;
}

export function release(): string {
	return uname().release;
}

export function version(): string {
	return uname().version;
}

export function hostname(): string {
	return uname().nodename;
}

export function machine(): string {
	return uname().machine;
}

export function arch(): string {
	return uname().machine;
}

export function platform(): 'linux' {
	return 'linux';
}

export function endianness(): 'LE' | 'BE' {
	return new Uint8Array(Uint16Array.of(1).buffer)[0] ? 'LE' : 'BE';
}

/** How long the kernel has been up, from the first of the two numbers in `/proc/uptime` */
export function uptime(): number {
	return parseFloat(readFileSync('/proc/uptime', 'utf8') as string);
}

export function homedir(): string {
	return process.env.HOME || '/';
}

export function tmpdir(): string {
	return process.env.TMPDIR || '/tmp';
}

export interface UserInfo {
	uid: number;
	gid: number;
	username: string;
	homedir: string;
	shell: string | null;
}

export function userInfo(): UserInfo {
	return {
		uid: getuid(),
		gid: getgid(),
		username: process.env.USER || process.env.USERNAME || 'root',
		homedir: homedir(),
		shell: process.env.SHELL || null,
	};
}

export default { EOL, arch, endianness, homedir, hostname, machine, platform, release, tmpdir, type, uptime, userInfo, version };
