import $ from 'jquery';
import { update } from './explorer.js';
import { cd, cwd, resolve } from '@zenfs/core/emulation/path.js';
import { fs } from '@zenfs/core';

export function switchTab(name: string): void {
	$('.tab').hide();
	$('#' + name)
		.filter('.tab')
		.show();

	$(`#nav button.active`).removeClass('active');
	$(`#nav button[name=${name}]`).addClass('active');

	if (name == 'explorer') {
		update();
	}
}

export function openPath(dir: string, fromShell: boolean = false): void {
	if (fs.statSync(dir).isDirectory()) {
		cd(dir);
		$('#location').val(cwd);
		return;
	}

	if (fromShell) {
		throw new Error(`Error: ENOTDIR: File is not a directory, '${resolve(dir)}'`);
	}

	switchTab('editor');
	$('#editor .content').text(fs.readFileSync(dir, 'utf-8'));
}
