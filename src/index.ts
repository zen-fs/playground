import '@xterm/xterm/css/xterm.css';
import './styles.css';

import { CopyOnWrite, Fetch, fs, InMemory, mount, resolveMountConfig, umount, type OptionsOf } from '@zenfs/core';
import { defaultContext } from '@zenfs/core/internal/contexts.js';
import { isAbsolute } from '@zenfs/core/path';
import { init } from '@zenfs/linux';
import $ from 'jquery';
import { openPath, switchTab } from './common.js';
import './config.js';
import './editor.js';
import { location } from './explorer.js';
import './lib/binfmt_nodejs.js';
import './device_tree.js';

// Switching tabs
$<HTMLButtonElement>('#nav button').on('click', e => switchTab(e.target.name));

location.on('change', () => {
	const value = location.val() ?? '';
	if (!isAbsolute(value)) {
		location.val(defaultContext.pwd);
		return;
	}

	if (!fs.existsSync(value)) {
		location.val(defaultContext.pwd);
		return;
	}

	openPath(value);
});

const search = new URLSearchParams(window.location.search);

if (search.has('tab')) switchTab(search.get('tab')!);

Object.assign(globalThis, { fs });

const fetchOptions: OptionsOf<typeof Fetch> = {
	baseUrl: new URL('./system', window.location.href).href,
	index: './index.json',
};

// we don't have to deal with initramfs, so we can just swap the root mount before running init
umount('/');
mount(
	'/',
	await resolveMountConfig({
		backend: CopyOnWrite,
		readable: { backend: Fetch, ...fetchOptions },
		writable: { backend: InMemory, label: 'root-cow' },
	})
);

await init({
	env: {
		SHELL: '/bin/sh',
		HOSTNAME: 'zenfs.dev',
		HOME: '/root',
		USERNAME: 'pg',
		TERM: 'xterm-256color',
		USER: 'pg',
		PATH: '/bin',
	},
});
