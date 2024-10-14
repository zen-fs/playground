import $ from 'jquery';
import { update as updateExplorer } from './explorer.js';
import { cd, cwd, resolve } from '@zenfs/core/emulation/path.js';
import { fs } from '@zenfs/core';
import * as editor from './editor.js';

export function switchTab(name: string): void {
	$('.tab').hide();
	$('#' + name)
		.filter('.tab')
		.show();

	$(`#nav button.active`).removeClass('active');
	$(`#nav button[name=${name}]`).addClass('active');

	if (name == 'explorer') {
		updateExplorer();
	}
}

export function openPath(path: string, fromShell: boolean = false): void {
	if (fs.statSync(path).isDirectory()) {
		cd(path);
		$('#location').val(cwd);
		updateExplorer();
		return;
	}

	if (fromShell) {
		throw new Error(`Error: ENOTDIR: File is not a directory, '${resolve(path)}'`);
	}

	void editor.open(path);
}

export function confirm(text: string): Promise<boolean> {
	const { promise, resolve } = Promise.withResolvers<boolean>();

	const dialog = $<HTMLDialogElement>('#confirm');
	dialog.find('.message').text(text);
	dialog[0].showModal();
	dialog.find('button.okay').on('click', () => resolve(true));
	dialog.find('button.cancel').on('click', () => resolve(false));
	void promise.then(() => dialog[0].close());
	return promise;
}

export function prompt(text: string): Promise<string | void> {
	const { promise, resolve } = Promise.withResolvers<string | void>();

	const dialog = $<HTMLDialogElement>('#prompt');
	dialog.find('.message').text(text);
	dialog.find('input').val('');
	dialog[0].showModal();
	dialog.find('button.okay').on('click', () => resolve(dialog.find('input').val()!));
	dialog.find('button.cancel').on('click', () => resolve());
	void promise.then(() => dialog[0].close());
	return promise;
}

export function alert(text: string): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();

	const dialog = $<HTMLDialogElement>('#alert');
	dialog.find('.message').text(text);
	dialog[0].showModal();
	dialog.find('button.okay').on('click', () => {
		resolve();
		dialog[0].close();
	});
	return promise;
}

Object.assign(globalThis, { openPath, switchTab, confirm });
