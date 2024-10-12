import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import './config.js';
import './shell.js';

// Switching tabs
$<HTMLButtonElement>('#nav button').on('click', e => {
	$('.tab').hide();
	$('#' + e.target.name)
		.filter('.tab')
		.show();
});
