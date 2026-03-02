#!/usr/bin/env node
import { build, context, type BuildOptions, type PluginBuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const {
	values: { mode = 'build' },
} = parseArgs({
	options: {
		mode: { short: 'm', type: 'string', default: 'build' },
	},
	strict: false,
	allowPositionals: true,
});

const outdir = 'build';

if (!existsSync('build')) {
	mkdirSync('build');
}

if (existsSync('system')) cpSync('system', 'build/system', { recursive: true });

const shared_config: BuildOptions = {
	target: 'esnext',
	keepNames: true,
	bundle: true,
	format: 'esm',
	platform: 'browser',
};

const lib_config: BuildOptions & { entryPoints: { in: string; out: string }[] } = {
	...shared_config,
	entryPoints: [],
	outdir: outdir + '/system/lib',
};

for (const specifier of ['@zenfs/core', 'utilium', 'utilium/shell.js', 'chalk', '@zenfs/core/path']) {
	lib_config.entryPoints.push({
		in: fileURLToPath(import.meta.resolve(specifier)),
		out: specifier,
	});
}

const bin_config: BuildOptions = {
	...shared_config,
	outdir: outdir + '/system/bin',
	packages: 'external',
	entryPoints: ['src/bin/*.ts'],
};

const config: BuildOptions = {
	...shared_config,
	entryPoints: ['src/index.ts', 'src/index.html', 'src/styles.css'],
	outdir,
	loader: {
		'.html': 'copy',
	},
	sourcemap: true,
	logOverride: {
		'direct-eval': 'info',
	},
	plugins: [
		{
			name: 'build-system',
			setup({ onStart }: PluginBuild): void | Promise<void> {
				onStart(async () => {
					await build(bin_config);
					for (const file of readdirSync(bin_config.outdir!)) {
						if (!file.endsWith('.js')) continue;
						const p = join(bin_config.outdir!, file);
						chmodSync(p, statSync(p).mode | 0o1111);
						renameSync(p, p.slice(0, -3));
					}
					await build(lib_config);
					execSync('npx make-index build/system -o build/index.json -q', { stdio: 'inherit' });
				});
			},
		},
	],
};

switch (mode) {
	case 'watch': {
		const ctx = await context(config);
		console.log('Watching for changes...');
		await ctx.watch();
		break;
	}
	case 'dev': {
		const ctx = await context(config);
		await ctx.watch();
		const { hosts, port } = await ctx.serve({ servedir: outdir });
		console.log(`Development server started: ${hosts.map(host => `\n\thttp://${host}:${port}`).join('')}`);
		break;
	}
	case 'build':
	default:
		await build(config);
}
