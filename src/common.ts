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

export function openPath(path: string, fromShell: boolean = false): void {
	if (fs.statSync(path).isDirectory()) {
		cd(path);
		$('#location').val(cwd);
		update();
		return;
	}

	if (fromShell) {
		throw new Error(`Error: ENOTDIR: File is not a directory, '${resolve(path)}'`);
	}

	switchTab('editor');
	$('#editor .content').text(fs.readFileSync(path, 'utf-8'));
	update();
}

export function confirm(text: string): Promise<boolean> {
	const { promise, resolve } = Promise.withResolvers<boolean>();

	const confirm = $<HTMLDialogElement>('#confirm');

	confirm.find('.message').text(text);

	confirm[0].showModal();

	confirm.find('button.okay').on('click', () => resolve(true));

	confirm.find('button.cancel').on('click', () => resolve(false));

	void promise.then(() => confirm[0].close());

	return promise;
}

Object.assign(globalThis, { openPath, switchTab, confirm });
