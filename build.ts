#!/usr/bin/env node
import { build, context, type BuildOptions } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
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

execSync('npx make-index commands -o build/index.json', { stdio: 'inherit' });

const config: BuildOptions = {
	entryPoints: ['src/index.ts', 'src/index.html', 'src/styles.css'],
	target: 'es2022',
	outdir,
	loader: {
		'.html': 'copy',
	},
	sourcemap: true,
	keepNames: true,
	bundle: true,
	format: 'esm',
	platform: 'browser',
	define: {
		$commands: JSON.stringify(Object.fromEntries(readdirSync('commands').map(name => ['/' + name, readFileSync('commands/' + name, 'utf-8')]))),
		$commands_index: readFileSync('build/index.json', 'utf-8'),
	},
	logOverride: {
		'direct-eval': 'info',
	},
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
