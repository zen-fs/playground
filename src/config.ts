/* eslint-disable @typescript-eslint/only-throw-error */
import type { Backend, OptionsOf } from '@zenfs/core';
import fs, { Fetch, InMemory, mounts, Overlay, Port } from '@zenfs/core';
import { WebAccess, WebStorage, IndexedDB } from '@zenfs/dom';
import { Iso, Zip } from '@zenfs/archives';
import $ from 'jquery';
import { randomHex, type Entries } from 'utilium';
import { cloneTemplate } from 'utilium/dom.js';
import { download, upload } from 'utilium/dom.js';

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
	// @zenfs/archives
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

function createNewMountConfig() {
	const li = $(cloneTemplate('#mount')).find('li');
	const id = randomHex(16);
	li.find('input[name=id]').val(id);
	const select = li.find('select');

	select.on('change', () => {
		li.find('[backend_specific]').remove();
		const backend = backends.find(({ backend }) => backend.name == select.val());
		if (!backend) {
			return;
		}
		for (const [name, data] of Object.entries(backend.inputs) as Entries<typeof backend.inputs>) {
			if (!data) {
				throw new Error();
			}

			const d = data as BackendInput;

			const input = $(d.select ? '<select></select>' : '<input />').attr({ ...d, select: null, parse: null, name, backend_specific: true });
			if (d.select) {
				for (const [value, text] of Object.entries(d.select)) {
					const opt = $('<option />').text(text).val(value);
					if (value == '') {
						opt.attr({ disabled: true, selected: true });
					}
					opt.appendTo(input);
				}
			}
			input.appendTo(li);
			d.ready?.(input[0] as BackendInputElement);
		}
	});

	for (const { backend } of backends) {
		$('<option />').text(backend.name).val(backend.name).appendTo(select);
	}
	li.appendTo('#config ul');
	return li;
}

function toFSTable(configs: Record<string, string>[]): string {
	return configs
		.map(({ id, backend, path, ...config }) =>
			[
				id,
				path,
				backend,
				Object.entries(config)
					.map(([k, v]) => k + '=' + v)
					.join(','),
			].join('\t')
		)
		.join('\n');
}

function fromFSTable(table: string): Record<string, string>[] {
	return table
		.split('\n')
		.filter(line => !/^\s*$/.test(line))
		.map<Record<string, string>>(line => {
			const [id, path, backend, options] = line.split(/\s+/);

			return {
				...(Object.fromEntries(options.split(',').map(entry => entry.split('='))) as object),
				id,
				path,
				backend,
			};
		});
}

function parseConfig(): Record<string, string>[] {
	const configs: Record<string, string>[] = [];

	$('#config ul')
		.find('li')
		.each((i: number, li: HTMLLIElement) => {
			configs[i] = {};
			$(li)
				.find<HTMLInputElement | HTMLSelectElement>('[name]')
				.each((_: number, input) => {
					configs[i][input.name] = input.value;
				});
		});
	return configs;
}

function loadConfig(configs: Record<string, string>[]): void {
	$('#config ul').find('li').remove();

	for (const config of configs) {
		const li = createNewMountConfig();
		li.find('[name=backend]').val(config.backend).trigger('change');

		for (const [key, value] of Object.entries(config).sort(([key]) => (key == 'backend' ? -1 : 1))) {
			li.find(`[name=${key}]`).val(value);
		}
	}
}

function saveTable(table: string, noLocalStorage: boolean = false): void {
	if (!fs.existsSync('/etc')) {
		fs.mkdirSync('/etc');
	}
	if (!noLocalStorage) localStorage.fstab = table;
	fs.writeFileSync('/etc/fstab', table);
}

$<HTMLInputElement>('#config .auto-load')[0].checked = 'autoLoad' in localStorage;

if (localStorage.autoLoad && localStorage.fstab) {
	const table = localStorage.getItem('fstab')!;
	loadConfig(fromFSTable(table));
	saveTable(table, true);
}

$('#config .add').on('click', createNewMountConfig);

$('#config .upload').on('click', () => {
	void upload()
		.then(response => response.text())
		.then(table => {
			loadConfig(fromFSTable(table));
			saveTable(table, true);
		});
});

$('#config .download').on('click', () => {
	const configs = parseConfig();
	download(toFSTable(configs), 'fstab');
});

$('#config .save').on('click', () => {
	saveTable(toFSTable(parseConfig()));
});

$<HTMLInputElement>('#config .auto-load').on('change', e => {
	if (e.target.checked) {
		localStorage.autoLoad = 1;
	} else {
		localStorage.removeItem('autoLoad');
	}
});
