import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import './config.js';
import './editor.js';
import { location } from './explorer.js';
import './shell.js';
import { cwd, isAbsolute } from '@zenfs/core/path';
import { fs } from '@zenfs/core';
import { openPath, switchTab } from './common.js';

// Switching tabs
$<HTMLButtonElement>('#nav button').on('click', e => switchTab(e.target.name));

location.on('change', () => {
	const value = location.val() ?? '';
	if (!isAbsolute(value)) {
		location.val(cwd);
		return;
	}

	if (!fs.existsSync(value)) {
		location.val(cwd);
		return;
	}

	openPath(value);
});
