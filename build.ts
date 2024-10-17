#!/usr/bin/env node
import { build, context, type BuildOptions, type PluginBuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
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

cpSync('system', 'build/system', { recursive: true });

const shared_config: BuildOptions = {
	target: 'es2022',
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

for (const specifier of ['@zenfs/core', 'utilium', 'chalk', '@zenfs/core/path']) {
	lib_config.entryPoints.push({
		in: fileURLToPath(import.meta.resolve(specifier)),
		out: specifier,
	});
}

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
			name: 'build-libs',
			setup({ onStart }: PluginBuild): void | Promise<void> {
				onStart(async () => {
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
		const { host, port } = await ctx.serve({ servedir: outdir });
		console.log(`Development server started at http://${['127.0.0.1', '0.0.0.0'].includes(host) ? 'localhost' : host}:${port}`);
		break;
	}
	case 'build':
	default:
		await build(config);
}
