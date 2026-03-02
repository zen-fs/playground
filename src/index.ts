import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import './config.js';
import './editor.js';
import { location } from './explorer.js';
import { isAbsolute } from '@zenfs/core/path';
import './tty.js';
import { fs } from '@zenfs/core';
import { openPath, switchTab } from './common.js';
import { defaultContext } from '@zenfs/core/internal/contexts.js';
import exec from './exec.js';

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

void exec('/bin/sh.js', [], { PATH: '/bin' });

Object.assign(globalThis, { fs });
