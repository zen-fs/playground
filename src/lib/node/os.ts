import { geteuid, uname } from '@zenfs/linux/uapi/process';
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

export interface UserInfo {
	uid: number;
	gid: number;
	username: string;
	homedir: string;
	shell: string | null;
}

function getpwuid(uid: number): UserInfo | undefined {
	let passwd: string;
	try {
		passwd = readFileSync('/etc/passwd', 'utf8') as string;
	} catch {
		return;
	}

	for (const line of passwd.split('\n')) {
		const [username, , id, gid, , home, shell] = line.split(':');
		if (Number(id) !== uid) continue;
		return { uid, gid: Number(gid), username, homedir: home, shell: shell || null };
	}
}

export function homedir(): string {
	return process.env.HOME || getpwuid(geteuid())?.homedir || '/';
}

export function tmpdir(): string {
	return process.env.TMPDIR || '/tmp';
}

export function userInfo(): UserInfo {
	const uid = geteuid();
	const entry = getpwuid(uid);
	if (!entry) throw Object.assign(new Error(`A system error occurred: uv_os_get_passwd returned ENOENT`), { code: 'ENOENT', errno: -2 });
	return entry;
}

export default { EOL, arch, endianness, homedir, hostname, machine, platform, release, tmpdir, type, uptime, userInfo, version };
