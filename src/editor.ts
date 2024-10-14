import { fs } from '@zenfs/core';
import $ from 'jquery';
import { prompt } from './common.js';

export const content = $<HTMLTextAreaElement>('#editor .content');

export let file: string | void;

export async function open(path?: string | void) {
	path ??= await prompt('Open file');
	if (!path) {
		return;
	}
	file = path;
	content.text(fs.readFileSync(file, 'utf-8'));
	content[0].focus();
}

export async function save() {
	file ||= await prompt('Save to path');
	if (!file) return;
	fs.writeFileSync(file, content.val()!);
}

content.on('keydown', e => {
	if (e.key == 'Tab') {
		e.preventDefault();
		const start = e.target.selectionStart;
		e.target.value = e.target.value.slice(0, start) + '\t' + e.target.value.slice(e.target.selectionEnd);
		e.target.selectionStart = e.target.selectionEnd = start + 1;
		return;
	}

	if (!e.ctrlKey) {
		return;
	}

	// Key combos
	switch (e.key) {
		case 'o':
			void open();
			break;
		case 's':
			e.preventDefault();
			void save();
			break;
	}
});
