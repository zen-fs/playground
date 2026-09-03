/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Console as NodeConsole } from 'node:console';
import type { WriteStream } from './tty.js';
import type { InspectOptions } from './util.js';
import { format, inspect } from './util.js';

export interface ConsoleConstructorOptions {
	stdout: WriteStream;
	stderr?: WriteStream;
	ignoreErrors?: boolean;
}

const box = {
	topLeft: '┌',
	topJoin: '┬',
	topRight: '┐',
	left: '├',
	join: '┼',
	right: '┤',
	bottomLeft: '└',
	bottomJoin: '┴',
	bottomRight: '┘',
	vertical: '│',
	horizontal: '─',
};

const valuesColumn = 'Values';

export class Console implements NodeConsole {
	public readonly stdout: WriteStream;
	public readonly stderr: WriteStream;

	public readonly Console = Console as any;

	protected readonly ignoreErrors: boolean;

	#groups: number = 0;

	readonly #counts = new Map<string, number>();
	readonly #timers = new Map<string, number>();

	public constructor(options: ConsoleConstructorOptions);
	public constructor(stdout: WriteStream, stderr?: WriteStream, ignoreErrors?: boolean);
	public constructor(options: ConsoleConstructorOptions | WriteStream, stderr?: WriteStream, ignoreErrors: boolean = true) {
		const opts = 'stdout' in options ? options : { stdout: options, stderr, ignoreErrors };

		this.stdout = opts.stdout;
		this.stderr = opts.stderr ?? opts.stdout;
		this.ignoreErrors = opts.ignoreErrors ?? true;
	}

	/** Write one message, indented by however deep `group` currently is */
	#write(stream: WriteStream, text: string): void {
		const indent = '  '.repeat(this.#groups);

		try {
			stream.write(indent + text.replaceAll('\n', '\n' + indent) + '\n');
		} catch (e) {
			if (!this.ignoreErrors) throw e;
		}
	}

	log = (...args: any[]): void => this.#write(this.stdout, format(...args));
	info = (...args: any[]): void => this.#write(this.stdout, format(...args));
	debug = (...args: any[]): void => this.#write(this.stdout, format(...args));
	warn = (...args: any[]): void => this.#write(this.stderr, format(...args));
	error = (...args: any[]): void => this.#write(this.stderr, format(...args));

	dir = (value: any, options?: InspectOptions): void => this.#write(this.stdout, inspect(value, options));

	dirxml = (...data: any[]): void => this.log(...data);

	trace = (...args: any[]): void => {
		const stack = new Error().stack?.split('\n').slice(2).join('\n');
		this.#write(this.stderr, `Trace: ${format(...args)}${stack ? '\n' + stack : ''}`);
	};

	assert = (value: any, ...args: any[]): void => {
		if (!value) this.#write(this.stderr, `Assertion failed${args.length ? ': ' + format(...args) : ''}`);
	};

	group = (...args: any[]): void => {
		if (args.length) this.log(...args);
		this.#groups++;
	};

	/** Nothing here can collapse, so a collapsed group is just a group */
	groupCollapsed = (...args: any[]): void => this.group(...args);

	groupEnd = (): void => {
		this.#groups = Math.max(this.#groups - 1, 0);
	};

	count = (label: string = 'default'): void => {
		const count = (this.#counts.get(label) ?? 0) + 1;
		this.#counts.set(label, count);
		this.log(`${label}: ${count}`);
	};

	countReset = (label: string = 'default'): void => {
		this.#counts.delete(label);
	};

	time = (label: string = 'default'): void => {
		if (this.#timers.has(label)) this.warn(`Warning: Label '${label}' already exists for console.time()`);
		else this.#timers.set(label, performance.now());
	};

	/** How long a timer has been running, without stopping it */
	timeLog = (label: string = 'default', ...data: any[]): void => {
		const elapsed = this.#elapsed(label);
		if (elapsed !== undefined) this.log(`${label}: ${elapsed}`, ...data);
	};

	timeEnd = (label: string = 'default'): void => {
		const elapsed = this.#elapsed(label);
		if (elapsed === undefined) return;
		this.#timers.delete(label);
		this.log(`${label}: ${elapsed}`);
	};

	#elapsed(label: string): string | undefined {
		const start = this.#timers.get(label);
		if (start === undefined) {
			this.warn(`Warning: No such label '${label}' for console.timeEnd()`);
			return;
		}

		const ms = performance.now() - start;
		return ms >= 1000 ? `${(ms / 1000).toFixed(3)}s` : `${ms.toFixed(3)}ms`;
	}

	clear = (): void => {
		if (this.stdout.isTTY) this.stdout.write('\x1b[2J\x1b[H');
	};

	table = (data?: any, properties?: readonly string[]): void => {
		if (data === null || (typeof data != 'object' && typeof data != 'function')) return this.log(data);

		const index: string[] = [];
		const columns: string[] = [];
		const rows: Record<string, string>[] = [];
		let hasValues = false;

		for (const [key, value] of Array.isArray(data) ? [...(data as unknown[]).entries()] : Object.entries(data as object)) {
			index.push(String(key));
			const row: Record<string, string> = {};

			if (value !== null && typeof value == 'object') {
				for (const [name, cell] of Object.entries(value as object)) {
					if (properties && !properties.includes(name)) continue;
					if (!columns.includes(name)) columns.push(name);
					row[name] = inspect(cell, { depth: 0 });
				}
			} else {
				hasValues = true;
				row[valuesColumn] = inspect(value, { depth: 0 });
			}

			rows.push(row);
		}

		const header = ['(index)', ...columns, ...(hasValues ? [valuesColumn] : [])];
		const body = rows.map((row, i) => [index[i], ...columns.map(name => row[name] ?? ''), ...(hasValues ? [row[valuesColumn] ?? ''] : [])]);

		const widths = header.map((name, i) => Math.max(name.length, ...body.map(cells => cells[i].length)));

		const rule = (left: string, join: string, right: string) => left + widths.map(width => box.horizontal.repeat(width + 2)).join(join) + right;
		const line = (cells: string[]) => box.vertical + cells.map((cell, i) => ` ${cell.padEnd(widths[i])} `).join(box.vertical) + box.vertical;

		const table = [
			rule(box.topLeft, box.topJoin, box.topRight),
			line(header),
			rule(box.left, box.join, box.right),
			...body.map(line),
			rule(box.bottomLeft, box.bottomJoin, box.bottomRight),
		];

		this.#write(this.stdout, table.join('\n'));
	};

	profile = (): void => {};
	profileEnd = (): void => {};
	timeStamp = (): void => {};
}
