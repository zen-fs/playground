/// <reference types="./lib.d.ts" />
// @ts-check

const [command, mode, filePath] = args;

// Helper to translate permission letters (r, w, x, etc.) to octal
const permissions = {
	r: 0o4, // Read
	w: 0o2, // Write
	x: 0o1, // Execute
	X: 0o1, // Execute if directory or already executable
	s: 0o4000, // Set user ID
	t: 0o1000, // Sticky bit
};

// Helper to apply permissions to user/group/other
function applyPermissions(currentMode, who, op, perms) {
	let targetMask = 0;
	const isAll = who.includes('a') || !who;
	if (who.includes('u')) targetMask |= 0o700; // User
	if (who.includes('g')) targetMask |= 0o070; // Group
	if (who.includes('o')) targetMask |= 0o007; // Others
	if (who.includes('a') || !who) targetMask |= 0o777; // All or no 'who'

	// Parse each permission character and apply based on the operator
	let permissionBits = 0;
	for (const perm of perms.split('')) {
		let bit = permissions[perm];
		if (!bit) throw new Error('Invalid permission: ' + perm);

		let isDir;
		try {
			isDir = fs.statSync(filePath).isDirectory();
		} catch (_) {}

		// Skip applying 'X' unless already executable or directory
		if (perm === 'X' && !(currentMode & 0o111 || isDir)) {
			break;
		}

		// Set the respective bits for 's' and 't'
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

let currentMode = fs.statSync(filePath).mode & 0o777;

function parseMode() {
	if (/^[0-7]{3}$/.test(mode)) {
		// Octal mode
		return parseInt(mode, 8);
	}

	// Symbolic mode handling
	const modeRegex = /([ugoa]*)([-+=])([rwxXstugo]+)/g;
	let match;
	while ((match = modeRegex.exec(mode)) !== null) {
		currentMode = applyPermissions(currentMode, match[1] || 'a', match[2], match[3]);
	}

	return currentMode;
}

fs.chmodSync(filePath, parseMode());
