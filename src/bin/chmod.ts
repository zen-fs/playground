import * as fs from '@zenfs/core';

const permissions: Record<string, number> = {
	r: 0o4,
	w: 0o2,
	x: 0o1,
	X: 0o1,
	s: 0o4000,
	t: 0o1000,
};

function applyPermissions(currentMode: number, filePath: string, who: string, op: string, perms: string) {
	let targetMask = 0;
	const isAll = who.includes('a') || !who;
	if (who.includes('u')) targetMask |= 0o700;
	if (who.includes('g')) targetMask |= 0o070;
	if (who.includes('o')) targetMask |= 0o007;
	if (who.includes('a') || !who) targetMask |= 0o777;

	let permissionBits = 0;
	for (const perm of perms.split('')) {
		const bit = permissions[perm];
		if (!bit) throw new Error('Invalid permission: ' + perm);

		let isDir;
		try {
			isDir = fs.statSync(filePath).isDirectory();
		} catch {}

		if (perm === 'X' && !(currentMode & 0o111 || isDir)) {
			break;
		}

		if (perm === 's' || perm === 't') {
			permissionBits |= bit;
			continue;
		}

		if (!(perm in permissions)) {
			break;
		}

		if (who.includes('u') || isAll) {
			permissionBits |= (bit & 0o7) << 6;
		}
		if (who.includes('g') || isAll) {
			permissionBits |= (bit & 0o7) << 3;
		}
		if (who.includes('o') || isAll) {
			permissionBits |= bit & 0o7;
		}
	}

	const change = permissionBits & targetMask;

	switch (op) {
		case '+':
			currentMode |= change;
			break;
		case '-':
			currentMode &= ~change;
			break;
		case '=':
			currentMode = change | (currentMode & ~targetMask);
			break;
	}

	return currentMode;
}

export default function main(...args: string[]) {
	const [, mode, ...filePaths] = args;

	if (!mode || !filePaths.length) {
		terminal.writeln('chmod: missing operand');
		return;
	}

	function parseMode(path: string, current: number) {
		if (/^[0-7]{3}$/.test(mode)) {
			return parseInt(mode, 8);
		}

		const modeRegex = /([ugoa]*)([-+=])([rwxXstugo]+)/g;
		let match;
		while ((match = modeRegex.exec(mode)) !== null) {
			current = applyPermissions(current, path, match[1] || 'a', match[2], match[3]);
		}

		return current;
	}

	for (const filePath of filePaths) {
		fs.chmodSync(filePath, parseMode(filePath, fs.statSync(filePath).mode & 0o777));
	}
}
