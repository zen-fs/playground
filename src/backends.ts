/* eslint-disable @typescript-eslint/only-throw-error */
import type { Backend, OptionsOf } from '@zenfs/core';
import { Fetch, InMemory, mounts, Overlay, Port } from '@zenfs/core';
import { WebAccess, WebStorage, IndexedDB } from '@zenfs/dom';
import { Iso } from '@zenfs/iso';
import { Zip } from '@zenfs/zip';
import $ from 'jquery';

export type HTMLAttributeName = 'id' | 'class' | 'style' | 'href' | 'src' | 'alt' | 'title' | 'placeholder';

export type BackendInputElement = HTMLInputElement | HTMLSelectElement;

export type BackendInput<Opts extends object = object, K extends keyof Opts = keyof Opts> = {
	select?: Record<string, string>;
	ready?(element: BackendInputElement): unknown;
	parse?(element: BackendInputElement): Opts[K] | Promise<Opts[K]>;
} & {
	[A in HTMLAttributeName]?: string;
};

export interface BackendOption<T extends Backend> {
	backend: T;
	inputs: {
		[K in keyof OptionsOf<T>]: BackendInput<OptionsOf<T>, K>;
	};
}

export const backends = [
	// @zenfs/core
	{
		backend: InMemory,
		inputs: {
			name: { placeholder: 'Name' },
		},
	},
	{
		backend: Fetch,
		inputs: {
			index: { placeholder: 'Index path' },
			baseUrl: { placeholder: 'Base URL' },
		},
	},
	{
		backend: Overlay,
		inputs: {
			readable: {
				placeholder: 'Readable mount',
				parse(input: HTMLInputElement) {
					return mounts.get(input.value);
				},
			},
			writable: {
				placeholder: 'Writable mount',
				parse(input: HTMLInputElement) {
					return mounts.get(input.value);
				},
			},
		},
	},
	{
		backend: Port,
		inputs: {
			/*port_file: {
				type: 'file',
				parse(input: HTMLInputElement) {
					const url = URL.createObjectURL(input.files![0]);
					$(input.parentElement!).find('.port').val(url).attr('disabled', 1);
				},
			},*/
			port: {
				placeholder: 'Port',
				parse(input: HTMLInputElement): Worker {
					return new Worker(input.value);
				},
			},
			timeout: {
				placeholder: 'Timeout',
				parse(input: HTMLInputElement) {
					return parseInt(input.value);
				},
			},
		},
	},
	// @zenfs/dom
	{
		backend: WebStorage,
		inputs: {
			storage: {
				select: {
					'': 'Select storage',
					localStorage: 'Local',
					sessionStorage: 'Session',
				},
				parse(input: HTMLSelectElement) {
					return globalThis[input.value as 'localStorage' | 'sessionStorage'];
				},
			},
		},
	},
	{
		backend: IndexedDB,
		inputs: {
			storeName: {
				placeholder: 'DB name',
			},
		},
	},
	{
		backend: WebAccess,
		inputs: {
			handle: {
				type: 'hidden',
				parse() {
					return navigator.storage.getDirectory();
				},
			},
		},
	},
	// @zenfs/zip
	{
		backend: Zip,
		inputs: {
			name: {
				type: 'hidden',
			},
			data: {
				type: 'file',
				parse(input: HTMLInputElement) {
					const file = input.files![0];
					if (!file) {
						throw 'No files uploaded';
					}
					$(input.parentElement!).find('.name').val(file.name);
					return file.arrayBuffer();
				},
			},
		},
	},
	// @zenfs/iso
	{
		backend: Iso,
		inputs: {
			data: {
				type: 'file',
				parse(input: HTMLInputElement) {
					const file = input.files![0];
					if (!file) {
						throw 'No files uploaded';
					}
					return file.arrayBuffer();
				},
			},
		},
	},
] satisfies BackendOption<Backend>[];
