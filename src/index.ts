import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import './config.js';
import './editor.js';
import { location } from './explorer.js';
import { isAbsolute } from '@zenfs/core/path';
import { tty } from './tty.js';
import { fs } from '@zenfs/core';
import { openPath, switchTab } from './common.js';
import { defaultContext } from '@zenfs/core/internal/contexts.js';
import { execve, Process } from '@zenfs/linux';
import './binfmt_nodejs.js';

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

export const initProc = new Process({
	context: defaultContext,
	tty,
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

execve(initProc, '/bin/sh');

Object.assign(globalThis, { fs });
