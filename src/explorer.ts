import { fs } from '@zenfs/core';
import { cwd, dirname, join } from '@zenfs/core/emulation/path.js';
import $ from 'jquery';
import { formatCompact } from 'utilium';
import { cloneTemplate } from 'utilium/dom.js';
import { openPath } from './common.js';

export const location = $<HTMLInputElement>('#location');

const endsWithLetter = /[^\d]$/;

function createEntry(name: string) {
	const stats = fs.statSync(join(cwd, name));

	const li = $(cloneTemplate('#entry')).find('li');

	const size = formatCompact(stats.size);
	li.find('.name').text(name);
	li.find('.size').text(size + (endsWithLetter.test(size) ? 'B' : ' bytes'));
	li.find('.mtime').text(stats.mtime.toLocaleString());

	li.on('click', e => {
		if (!e.shiftKey && li.hasClass('selected')) {
			openPath(name);
			update();
			return;
		}

		if (!e.shiftKey) {
			$('#explorer li.entry.selected').removeClass('selected');
		}

		li.toggleClass('selected');
		$('#explorer .menu').hide();
	});

	li.on('contextmenu', e => {
		e.preventDefault();

		$('#explorer .menu')
			.toggle()
			.css({
				left: e.clientX + 'px',
				top: e.clientY + 'px',
			});
		return false;
	});

	li.appendTo('#explorer');
}

export function update() {
	$('#explorer li.entry').remove();

	for (const file of fs.readdirSync(cwd)) {
		createEntry(file);
	}
}

$('#explorer .parent').on('click', () => {
	openPath(dirname(cwd));
	update();
});
