import * as fs from '@zenfs/core';
import * as path from '@zenfs/core/path';

function getPath(): string[] {
	process.env.PATH ||= '/bin';
	return process.env.PATH.split(':');
}

const shell = createShell({
	terminal,
	get prompt(): string {
		return `[pg@zenfs.dev ${process.cwd() == '/root' ? '~' : path.basename(process.cwd()) || '/'}]$ `;
	},
	/**
	 * @todo output to history file
	 */
	async onLine(line) {
		try {
			const args = line.trim().split(' ');

			if (!args[0]) return;

			let file: string | undefined;

			for (const dir of getPath()) {
				const p = path.join(dir, args[0] + '.js');
				if (fs.existsSync(p)) file = p;
			}

			if (!file) throw 'Unknown command: ' + args[0];

			await exec(file, args, process.env);
		} catch (error: any) {
			terminal.writeln('Error: ' + (error.message ?? error));
		}
	},
});
terminal.write(shell.prompt);
