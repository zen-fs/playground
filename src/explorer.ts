import { fs } from '@zenfs/core';
import $ from 'jquery';
import { formatCompact } from 'utilium';
import { cloneTemplate } from 'utilium/dom.js';
import { confirm, openPath } from './common.js';

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

	const stats = fs.statSync(entry.name);

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

	li.appendTo('#explorer ul');

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
	$('#explorer ul li.entry').remove();

	for (const name of fs.readdirSync('.')) {
		createEntry(name);
	}
}

$('#explorer .menu .open').on('click', () => openPath(contextMenuTarget!.name));
$('#explorer .menu .rename').on('click', () => renameEntry(contextMenuTarget!));
// eslint-disable-next-line @typescript-eslint/no-misused-promises
$('#explorer .menu .delete').on('click', async e => {
	if (e.shiftKey || (await confirm(`Are you sure you want to delete "${contextMenuTarget!.name}"?`))) {
		removeEntry(contextMenuTarget!);
	}
});

$('#explorer').on('click', () => $('#explorer .menu').hide());
$('#explorer').on('contextmenu', () => $('#explorer .menu').hide());

$('#explorer .parent').on('click', () => {
	openPath('..');
});

const create = $<HTMLDialogElement>('#explorer dialog.create'),
	createName = create.find<HTMLInputElement>('.inputs .name');

$('#explorer .new').on('click', () => {
	create[0].showModal();
});

create.find('button.cancel').on('click', () => {
	create.find('input,select').val('');
	create.find('.error').text('').css({ height: 0 });
	create[0].close();
});

createName.on('keydown change focus blur', e => {
	if (e.target.value) {
		create.find('button.create').removeAttr('disabled');
	} else {
		create.find('button.create').attr('disabled', 1);
	}
});

create.find('button.create').on('click', () => {
	const type = create.find<HTMLSelectElement>('.inputs .type').val()!;
	if (!type) {
		create.find('.error').text('You must select a file type').animate({ height: '1em' }, 250);
		return;
	}

	const name = createName.val()!;
	if (!name) {
		create.find('.error').text('You must provide a file name').animate({ height: '1em' }, 250);
		return;
	}

	if (fs.existsSync(name)) {
		create.find('.error').text('A file with that name already exists').animate({ height: '1em' }, 250);
		return;
	}

	switch (type) {
		case 'file':
			fs.writeFileSync(name, '');
			break;
		case 'directory':
			fs.mkdirSync(name);
			break;
		default:
			create.find('.error').text('Invalid file type').animate({ height: '1em' }, 250);
			return;
	}

	createEntry(name);
	create[0].close();
});
