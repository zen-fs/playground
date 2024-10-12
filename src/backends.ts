import type { Backend, OptionsOf } from '@zenfs/core';
import { Fetch, InMemory, Overlay, Port } from '@zenfs/core';
import $ from 'jquery';

export type HTMLAttributeName = 'id' | 'class' | 'style' | 'href' | 'src' | 'alt' | 'title' | 'placeholder';

export interface BackendOption<T extends Backend> {
	backend: T;

	inputs: {
		[K in keyof OptionsOf<T>]: {
			parse?(element: HTMLInputElement): OptionsOf<T>[K];
		} & {
			[A in HTMLAttributeName]?: string;
		};
	};
}

export const backends = [
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
			readable: { placeholder: 'Readable' },
			writable: { placeholder: 'Writable' },
		},
	},
	{
		backend: Port,
		inputs: {
			port_file: {
				type: 'file',
				parse(input: HTMLInputElement) {
					const url = URL.createObjectURL(input.files![0]);
					$(input.parentElement!).find('.port').val(url).attr('disabled', 1);
				},
			},
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
] satisfies BackendOption<Backend>[];
