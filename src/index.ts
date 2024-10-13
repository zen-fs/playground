import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import './config.js';
import { update } from './explorer.js';
import './shell.js';
import { cwd, isAbsolute } from '@zenfs/core/emulation/path.js';
import { fs } from '@zenfs/core';
import { cd } from './common.js';

// Switching tabs
$<HTMLButtonElement>('#nav button').on('click', e => {
	$('.tab').hide();
	$('#' + e.target.name)
		.filter('.tab')
		.show();

	if (e.target.name == 'explorer') {
		update();
	}
});

const location = $<HTMLInputElement>('#location');

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

	cd(value);
});
