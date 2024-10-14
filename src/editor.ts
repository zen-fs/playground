import { fs } from '@zenfs/core';
import $ from 'jquery';
import { prompt, switchTab } from './common.js';

export const content = $<HTMLTextAreaElement>('#editor .content');

export let file: string | void;

let savedContent: string | undefined;

function updateButtons() {
	if (!file) {
		$('#editor button.save').removeAttr('disabled');
		return;
	}

	if (content.val() == savedContent) {
		$('#editor button.save').attr('disabled', 1);
	} else {
		$('#editor button.save').removeAttr('disabled');
	}
}

export async function open(path?: string | void) {
	path ??= await prompt('Open file');
	if (!path) {
		return;
	}
	file = path;
	const data = fs.readFileSync(file, 'utf-8');
	content.val(data);
	savedContent = data;
	content[0].focus();
	switchTab('editor');
}

export async function save() {
	file ||= await prompt('Save to path');
	if (!file) return;
	fs.writeFileSync(file, content.val()!);
	savedContent = content.val();
	updateButtons();
}

export function reload() {
	if (!file) return;
	content.val(fs.readFileSync(file, 'utf-8'));
	updateButtons();
}

function handleKeydown(e: JQuery.KeyDownEvent<HTMLTextAreaElement, unknown, HTMLTextAreaElement, HTMLTextAreaElement>) {
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
			e.preventDefault();
			void open();
			break;
		case 's':
			e.preventDefault();
			void save();
			break;
	}
}

content.on('keydown', e => {
	handleKeydown(e);
	setTimeout(updateButtons);
});

$('#editor button.save').on('click', () => void save());
$('#editor button.reload').on('click', () => void reload());
