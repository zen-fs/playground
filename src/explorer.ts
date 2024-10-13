import { fs } from '@zenfs/core';
import { cwd, join } from '@zenfs/core/emulation/path.js';
import $ from 'jquery';
import { cloneTemplate } from 'utilium/dom.js';

function createEntry(name: string) {
	const stats = fs.statSync(join(cwd, name));

	const li = $(cloneTemplate('#entry')).find('li');

	li.find('.name').text(name);
	li.find('.size').text(stats.size);
	li.find('.mtime').text(stats.mtime.toLocaleString());

	li.appendTo('#explorer');
}

export function update() {
	$('#explorer li.entry').remove();

	for (const file of fs.readdirSync(cwd)) {
		createEntry(file);
	}
}
