import '@xterm/xterm/css/xterm.css';
import './styles.css';

import $ from 'jquery';
import { randomHex, type Entries } from 'utilium';
import { backends, type BackendInput, type BackendInputElement } from './config.js';
import './shell.js';
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
		li.find('[backend_specific]').remove();
		const backend = backends.find(({ backend }) => backend.name == select.val());
		if (!backend) {
			return;
		}
		for (const [name, data] of Object.entries(backend.inputs) as Entries<typeof backend.inputs>) {
			if (!data) {
				throw new Error();
			}

			const d = data as BackendInput;

			const input = $(d.select ? '<select></select>' : '<input />').attr({ ...d, select: null, parse: null, name, backend_specific: true });
			if (d.select) {
				for (const [value, text] of Object.entries(d.select)) {
					const opt = $('<option />').text(text).val(value);
					if (value == '') {
						opt.attr({ disabled: true, selected: true });
					}
					opt.appendTo(input);
				}
			}
			input.appendTo(li);
			d.ready?.(input[0] as BackendInputElement);
		}
	});

	for (const { backend } of backends) {
		$('<option />').text(backend.name).val(backend.name).appendTo(select);
	}
	li.appendTo('#config');
});

$('#config .update').on('click', () => {});
