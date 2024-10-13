import { fs } from '@zenfs/core';
import { cwd, join, cd, resolve } from '@zenfs/core/emulation/path.js';
import $ from 'jquery';
import { formatCompact } from 'utilium';
import { cloneTemplate } from 'utilium/dom.js';

export const location = $<HTMLInputElement>('#location');

export function openPath(dir: string, fromShell: boolean = false): void {
	if (fs.statSync(dir).isDirectory()) {
		cd(dir);
		$('#location').val(cwd);
		return;
	}

	if (fromShell) {
		throw new Error(`Error: ENOTDIR: File is not a directory, '${resolve(dir)}'`);
	}
}

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
	});

	li.appendTo('#explorer');
}

export function update() {
	$('#explorer li.entry').remove();

	for (const file of fs.readdirSync(cwd)) {
		createEntry(file);
	}
}
