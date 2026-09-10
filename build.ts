#!/usr/bin/env node
import { build, context, type BuildOptions, type PluginBuild } from 'esbuild';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createServer, request } from 'node:http';
import { join } from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import wali_precompiled from './wali_precomiled.json' with { type: 'json' };

const {
	values: { mode = 'build', port = '8000' },
	positionals: [command],
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

function digest(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex');
}

let precompiledHasRun = false;

async function getPrecompiledPrograms(into: string = 'system/bin'): Promise<void> {
	fs.mkdirSync(into, { recursive: true });

	for (const { name, path, sha256 } of wali_precompiled.programs) {
		const target = join(into, name);

		if (fs.existsSync(target) && digest(fs.readFileSync(target)) == sha256) {
			!precompiledHasRun && console.log('already downloaded', name);
			continue;
		}

		const url = `https://raw.githubusercontent.com/Wasm-Thin-Kernel-Interfaces/WALI/${wali_precompiled.ref}/${path}`;
		process.stdout.write(`downloading precompiled ${name}... `);

		const response = await fetch(url);
		if (!response.ok) throw new Error(`${url} gave ${response.status} ${response.statusText}`);

		const data = await response.bytes();
		const got = digest(data);

		if (got != sha256) throw new Error(`expected sha256 ${sha256}, got ${got}`);

		fs.writeFileSync(target, data);
		fs.chmodSync(target, 0o755);

		console.log(`done. (${(data.byteLength / 1048576).toFixed(1)} MB)`);
	}

	precompiledHasRun = true;
}

if (command === 'get-wasm') {
	await getPrecompiledPrograms();
	process.exit(0);
}

const isolation = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp',
};

if (!fs.existsSync('build')) {
	fs.mkdirSync('build');
}

fs.writeFileSync('build/CNAME', 'playground.zenfs.dev');

const singletons = ['@zenfs/core', '@zenfs/streams', 'memium', 'kerium', 'utilium'];

const dedupe: NonNullable<BuildOptions['plugins']>[number] = {
	name: 'dedupe',
	setup(build: PluginBuild) {
		const filter = new RegExp(`^(${singletons.map(name => name.replace('/', '\\/')).join('|')})(\\/.*)?$`);

		build.onResolve({ filter }, async args => {
			if (args.pluginData === dedupe) return null;

			const resolved = await build.resolve(args.path, {
				kind: args.kind,
				resolveDir: import.meta.dirname,
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

const lib_config: BuildOptions = {
	...shared_config,
	outdir: outdir + '/system/lib',
	splitting: true,
	entryPoints: [{ in: fileURLToPath(import.meta.resolve('utilium/shell')), out: 'utilium/shell' }],
};

const bin_config: BuildOptions = {
	...shared_config,
	outdir: outdir + '/system/bin',
	packages: 'external',
	entryPoints: ['src/bin/*.ts'],
};

const interpreters = ['node', 'wali'];

const interpreter_config: BuildOptions = {
	...shared_config,
	outdir: outdir + '/system/bin',
	define: { process: '{ "env": {} }' },
	entryPoints: interpreters.map(name => ({ in: `src/lib/${name}/main.ts`, out: name })),
};

const config: BuildOptions = {
	...shared_config,
	entryPoints: ['src/index.ts', 'src/index.html', 'src/styles.css'],
	outdir,
	loader: { '.html': 'copy' },
	sourcemap: true,
	logOverride: { 'direct-eval': 'info' },
	define: { process: '{ "env": {} }' },
	plugins: [
		dedupe,
		{
			name: 'build-system',
			setup({ onStart }: PluginBuild): void | Promise<void> {
				onStart(async () => {
					fs.rmSync(bin_config.outdir!, { recursive: true, force: true });
					fs.rmSync(lib_config.outdir!, { recursive: true, force: true });

					await build(bin_config);
					for (const file of fs.readdirSync(bin_config.outdir!)) {
						if (!file.endsWith('.js')) continue;
						const p = join(bin_config.outdir!, file);
						fs.chmodSync(p, fs.statSync(p).mode | 0o1111);
						fs.renameSync(p, p.slice(0, -3));
					}
					await build(interpreter_config);
					for (const name of interpreters) {
						const p = join(interpreter_config.outdir!, name + '.js');
						fs.chmodSync(p, 0o755);
						fs.renameSync(p, join(interpreter_config.outdir!, name));
					}

					await build(lib_config);

					await getPrecompiledPrograms();
					if (fs.existsSync('system')) fs.cpSync('system', 'build/system', { recursive: true });

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
