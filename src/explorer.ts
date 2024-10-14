import { fs } from '@zenfs/core';
import { cwd, dirname, join } from '@zenfs/core/emulation/path.js';
import $ from 'jquery';
import { formatCompact } from 'utilium';
import { cloneTemplate } from 'utilium/dom.js';
import { openPath } from './common.js';

export const location = $<HTMLInputElement>('#location');

const endsWithLetter = /[^\d]$/;

let contextMenuTarget: Entry | undefined;

interface Entry {
	name: string;
	li: JQuery<HTMLLIElement>;
}

function createEntry(name: string) {
	const li = $(cloneTemplate('#entry')).find('li');

	const entry = { name, li };

	const stats = fs.statSync(join(cwd, entry.name));

	const size = formatCompact(stats.size);
	li.find('.name').text(entry.name);
	li.find('.size').text(size + (endsWithLetter.test(size) ? 'B' : ' bytes'));
	li.find('.mtime').text(stats.mtime.toLocaleString());

	li.on('click', e => {
		if (!e.shiftKey && li.hasClass('selected')) {
			openPath(entry.name);
			return;
		}

		if (!e.shiftKey) {
			$('#explorer li.entry.selected').removeClass('selected');
		}

		li.toggleClass('selected');
	});

	li.on('contextmenu', e => {
		e.preventDefault();
		e.stopPropagation();

		contextMenuTarget = entry;

		$('#explorer .menu')
			.toggle()
			.css({
				left: e.clientX + 'px',
				top: e.clientY + 'px',
			});

		return false;
	});

	li.appendTo('#explorer');

	return entry;
}

function renameEntry(entry: Entry) {
	const { li, name } = entry;
	li.find('.name').text('');

	const input = $<HTMLInputElement>('<input />').addClass('entry-rename').val(name).appendTo(li.find('.name'));

	const handleEvent = () => {
		const value = input.val();

		if (!value) {
			return;
		}
		fs.renameSync(name, value);
		entry.name = value;
		input.remove();
		li.find('.name').text(value);
	};

	input.on('blur', handleEvent);
	input.on('keydown', e => {
		switch (e.key) {
			case 'Enter':
				return handleEvent();
			case 'Escape':
				input.remove();
				li.find('.name').text(name);
				break;
		}
	});
}

function removeEntry(entry: Entry) {
	fs.rmSync(entry.name);
	entry.li.remove();
}

export function update() {
	$('#explorer li.entry').remove();

	for (const name of fs.readdirSync(cwd)) {
		createEntry(name);
	}
}

$('#explorer .menu .open').on('click', () => openPath(contextMenuTarget!.name));
$('#explorer .menu .rename').on('click', () => renameEntry(contextMenuTarget!));
$('#explorer .menu .delete').on('click', () => removeEntry(contextMenuTarget!));

$('#explorer').on('click', () => $('#explorer .menu').hide());
$('#explorer').on('contextmenu', () => $('#explorer .menu').hide());

$('#explorer .parent').on('click', () => {
	openPath(dirname(cwd));
});
