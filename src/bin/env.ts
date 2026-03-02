export default async function main(_name: string, ...args: string[]) {
	const pattern = /^([\w\d_]+)=(.*)$/i;
	let match: RegExpExecArray | null;

	const env = { ...process.env };

	while ((match = pattern.exec(args[0]))) {
		args.shift();
		const [, key, value] = match;
		env[key] = value;
	}

	if (args.length) return await exec('/bin/sh', args, env);

	for (const [key, value] of Object.entries(env)) {
		terminal.writeln(`${key}=${value}`);
	}
}
