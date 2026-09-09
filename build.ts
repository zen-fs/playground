#!/usr/bin/env node
import { build, context, type BuildOptions, type PluginBuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const {
	values: { mode = 'build', port = '8000' },
} = parseArgs({
	options: {
		mode: { short: 'm', type: 'string', default: 'build' },
		port: { short: 'p', type: 'string', default: '8000' },
	},
	strict: false,
	allowPositionals: true,
});

const outdir = 'build';

const devPort = Number(port) || 8000;

const isolation = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp',
};

if (!existsSync('build')) {
	mkdirSync('build');
}

if (existsSync('system')) cpSync('system', 'build/system', { recursive: true });

writeFileSync('build/CNAME', 'playground.zenfs.dev');

const singletons = ['@zenfs/core', '@zenfs/streams', 'memium', 'kerium', 'utilium'];

/** Resolve those from here, wherever they were imported from, so only one copy is bundled */
const here = fileURLToPath(new URL('.', import.meta.url));

const dedupe: NonNullable<BuildOptions['plugins']>[number] = {
	name: 'dedupe',
	setup(build: PluginBuild) {
		const filter = new RegExp(`^(${singletons.map(name => name.replace('/', '\\/')).join('|')})(\\/.*)?$`);

		build.onResolve({ filter }, async args => {
			if (args.pluginData === dedupe) return null;

			const resolved = await build.resolve(args.path, {
				kind: args.kind,
				resolveDir: here,
				pluginData: dedupe,
			});

			return resolved.errors.length ? null : resolved;
		});
	},
};

const shared_config: BuildOptions = {
	target: 'esnext',
	keepNames: true,
	bundle: true,
	format: 'esm',
	platform: 'browser',
	plugins: [dedupe],
};

const lib_config: BuildOptions & { entryPoints: { in: string; out: string }[] } = {
	...shared_config,
	entryPoints: [],
	outdir: outdir + '/system/lib',
};

for (const specifier of ['@zenfs/core', 'utilium', 'utilium/shell', '@zenfs/core/path']) {
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

const thread_config: BuildOptions = {
	...shared_config,
	outdir: outdir + '/system',
	splitting: true,
	define: {
		process: '{ "env": {} }',
	},
	entryPoints: [
		{ in: fileURLToPath(import.meta.resolve('@zenfs/linux/uapi/bootstrap')), out: 'bootstrap' },
		{ in: 'src/runtime.ts', out: 'runtime' },
	],
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
	define: {
		process: '{ "env": {} }',
	},
	plugins: [
		dedupe,
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

					// Splitting names chunks by content, so old ones would pile up in the index
					for (const file of readdirSync(thread_config.outdir!)) {
						if (file.startsWith('chunk-')) rmSync(join(thread_config.outdir!, file));
					}
					await build(thread_config);
					execSync('npx -s make-index build/system -o build/index.json -q', { stdio: 'inherit' });
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

		// esbuild's server can't add headers, so it serves to a proxy that does
		const upstream = await ctx.serve({ servedir: outdir, host: '127.0.0.1', port: 0 });

		const server = createServer((req, res) => {
			const proxied = request({ host: '127.0.0.1', port: upstream.port, path: req.url, method: req.method, headers: req.headers }, from => {
				res.writeHead(from.statusCode ?? 500, { ...from.headers, ...isolation });
				from.pipe(res, { end: true });
			});

			req.pipe(proxied, { end: true });
		});

		await new Promise<void>(resolve => server.listen(devPort, resolve));
		console.log(`Development server started: http://localhost:${devPort}`);
		break;
	}
	case 'build':
	default:
		await build(config);
}
