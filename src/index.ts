/* eslint-disable @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment */
import '@xterm/xterm/css/xterm.css';
import './styles.css';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import $ from 'jquery';
import { randomHex, type Entries } from 'utilium';
import { backends } from './backends.js';
import { instantiateTemplate } from './templates.js';

// Switching tabs
$<HTMLButtonElement>('#nav button').on('click', e => {
	$('.tab').hide();
	$('#' + e.target.name)
		.filter('.tab')
		.show();
});

$('#config .add').on('click', () => {
	const li = instantiateTemplate('#mount').find('li');
	const id = randomHex(16);
	li.find('input[name=id]').val(id);
	const select = li.find('select');

	select.on('change', () => {
		li.find('input').filter('[backend_specific]').remove();
		const backend = backends.find(({ backend }) => backend.name == select.val());
		if (!backend) {
			return;
		}
		for (const [name, data] of Object.entries(backend.inputs) as Entries<typeof backend.inputs>) {
			if (!data) {
				throw new Error();
			}

			$('<input />')
				.attr({ ...data, name, backend_specific: true })
				.appendTo(li);
		}
	});

	for (const { backend } of backends) {
		$('<option />').text(backend.name).val(backend.name).appendTo(select);
	}
	li.appendTo('#config');
});

$('#config .update').on('click', () => {});

const terminal = new Terminal();
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.open($('#terminal-container')[0]);
fitAddon.fit();
