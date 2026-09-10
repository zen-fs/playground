const args = process.argv.slice(1);

let newline = true;
let escapes = false;

while (args.length && /^-[neE]+$/.test(args[0])) {
	if (args[0].includes('n')) newline = false;
	if (args[0].includes('e')) escapes = true;
	if (args[0].includes('E')) escapes = false;
	args.shift();
}

const codes: Record<string, string> = { '\\': '\\', a: '\x07', b: '\b', e: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

function unescape(text: string): string {
	return text.replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (match, code: string) => {
		if (code in codes) return codes[code];
		if (code.startsWith('x')) return String.fromCharCode(parseInt(code.slice(1), 16));
		if (/^[0-7]+$/.test(code)) return String.fromCharCode(parseInt(code, 8));
		return match;
	});
}

const text = args.join(' ');

process.stdout.write((escapes ? unescape(text) : text) + (newline ? '\n' : ''));
