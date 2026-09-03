import type { InspectColor, ParseArgsConfig, ParseArgsOptionDescriptor, ParseArgsOptionsConfig, parseArgs as nodeParseArgs } from 'node:util';

/**
 * ANSI escape codes for each format, from `util.inspect.colors`.
 */
export const colors: Record<string, [open: number, close: number]> = {
	reset: [0, 0],
	bold: [1, 22],
	dim: [2, 22],
	italic: [3, 23],
	underline: [4, 24],
	blink: [5, 25],
	inverse: [7, 27],
	hidden: [8, 28],
	strikethrough: [9, 29],
	doubleunderline: [21, 24],
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49],
	framed: [51, 54],
	overlined: [53, 55],
	gray: [90, 39],
	redBright: [91, 39],
	greenBright: [92, 39],
	yellowBright: [93, 39],
	blueBright: [94, 39],
	magentaBright: [95, 39],
	cyanBright: [96, 39],
	whiteBright: [97, 39],
	bgGray: [100, 49],
	bgRedBright: [101, 49],
	bgGreenBright: [102, 49],
	bgYellowBright: [103, 49],
	bgBlueBright: [104, 49],
	bgMagentaBright: [105, 49],
	bgCyanBright: [106, 49],
	bgWhiteBright: [107, 49],
};

/**
 * A polyfill for `util.styleText`.
 * Colors are always emitted since the terminal always supports them.
 * When an array is passed, formats are applied left to right, so later ones win.
 */
export function styleText(format: InspectColor | readonly InspectColor[], text: string): string {
	if (typeof format != 'string') {
		for (let i = format.length - 1; i >= 0; i--) text = styleText(format[i], text);
		return text;
	}

	const codes = colors[format];
	if (!codes) throw new TypeError(`Invalid format: ${format}`);
	return `\x1b[${codes[0]}m${text}\x1b[${codes[1]}m`;
}

type ParseArgsResult<T extends ParseArgsConfig> = ReturnType<typeof nodeParseArgs<T>>;

interface OptionToken {
	kind: 'option';
	index: number;
	name: string;
	rawName: string;
	value: string | undefined;
	inlineValue: boolean | undefined;
}

type ParsedToken = OptionToken | { kind: 'positional'; index: number; value: string } | { kind: 'option-terminator'; index: number };

type OptionValue = string | boolean;

/**
 * Creates an error with a Node-style `code`.
 * Messages are close to Node's, though not formatted with `util.inspect`.
 */
function parseArgsError(code: string, message: string): TypeError {
	const error = new TypeError(message);
	Object.defineProperty(error, 'code', { value: code, writable: true, configurable: true });
	return error;
}

function display(value: unknown): string {
	return typeof value == 'string' ? `'${value}'` : typeof value == 'object' && value ? Object.prototype.toString.call(value) : String(value);
}

function invalidArg(name: string, expected: string, value: unknown): TypeError {
	return parseArgsError('ERR_INVALID_ARG_TYPE', `The "${name}" argument must be ${expected}. Received ${display(value)}`);
}

function validateBoolean(value: unknown, name: string): void {
	if (typeof value != 'boolean') throw invalidArg(name, 'of type boolean', value);
}

function objectGetOwn<T extends object, K extends keyof T>(obj: T, prop: K): T[K] | undefined {
	if (Object.hasOwn(obj, prop)) return obj[prop];
}

function optionsGetOwn<K extends keyof ParseArgsOptionDescriptor>(options: ParseArgsOptionsConfig, longOption: string, prop: K): ParseArgsOptionDescriptor[K] | undefined {
	if (!Object.hasOwn(options, longOption)) return;
	return objectGetOwn(options[longOption], prop);
}

function findLongOptionForShort(shortOption: string, options: ParseArgsOptionsConfig): string {
	for (const [longOption, config] of Object.entries(options)) {
		if (objectGetOwn(config, 'short') === shortOption) return longOption;
	}
	return shortOption;
}

/** Turns args into tokens: options (along with their values, if any), positionals, and the option terminator. */
function argsToTokens(args: readonly string[], options: ParseArgsOptionsConfig): ParsedToken[] {
	const tokens: ParsedToken[] = [];
	let index = -1;
	let groupCount = 0;

	const remaining = args.slice();
	while (remaining.length) {
		const arg = remaining.shift()!;
		// An option argument may start with a dash, so anything present is taken greedily.
		const hasNext = remaining.length > 0;

		if (groupCount > 0) groupCount--;
		else index++;

		// Everything after a bare '--' is a positional argument (guideline 10).
		if (arg == '--') {
			tokens.push({ kind: 'option-terminator', index });
			for (const value of remaining) tokens.push({ kind: 'positional', index: ++index, value });
			break;
		}

		if (arg.length == 2 && arg.charAt(0) == '-' && arg.charAt(1) != '-') {
			// e.g. '-f'
			const name = findLongOptionForShort(arg.charAt(1), options);
			let value: string | undefined;
			let inlineValue: boolean | undefined;
			if (optionsGetOwn(options, name, 'type') == 'string' && hasNext) {
				// e.g. '-f', 'bar'
				value = remaining.shift();
				inlineValue = false;
			}
			tokens.push({ kind: 'option', name, rawName: arg, index, value, inlineValue });
			if (value != null) index++;
			continue;
		}

		const isMultiShort = !(arg.length <= 2 || arg.charAt(0) != '-' || arg.charAt(1) == '-'),
			optionType = isMultiShort && optionsGetOwn(options, findLongOptionForShort(arg.charAt(1), options), 'type');

		if (isMultiShort && optionType != 'string') {
			// Expand -fXzy to -f -X -z -y
			const expanded: string[] = [];
			for (let i = 1; i < arg.length; i++) {
				const shortOption = arg.charAt(i);
				const name = findLongOptionForShort(shortOption, options);
				if (optionsGetOwn(options, name, 'type') != 'string' || i == arg.length - 1) {
					// Boolean option, or last short in the group. Well formed.
					expanded.push(`-${shortOption}`);
					continue;
				}
				// String option in the middle. Yuck. Expand -abfFILE to -a -b -fFILE
				expanded.push(`-${arg.slice(i)}`);
				break;
			}
			remaining.unshift(...expanded);
			groupCount = expanded.length;
			continue;
		}

		if (isMultiShort && optionType == 'string') {
			// e.g. '-fFILE'
			const shortOption = arg.charAt(1);
			const name = findLongOptionForShort(shortOption, options);
			tokens.push({ kind: 'option', name, rawName: `-${shortOption}`, index, value: arg.slice(2), inlineValue: true });
			continue;
		}

		if (arg.length > 2 && arg.startsWith('--') && !arg.includes('=', 3)) {
			// e.g. '--foo'
			const name = arg.slice(2);
			let value: string | undefined;
			let inlineValue: boolean | undefined;
			if (optionsGetOwn(options, name, 'type') == 'string' && hasNext) {
				// e.g. '--foo', 'bar'
				value = remaining.shift();
				inlineValue = false;
			}
			tokens.push({ kind: 'option', name, rawName: arg, index, value, inlineValue });
			if (value != null) index++;
			continue;
		}

		if (arg.length > 2 && arg.startsWith('--') && arg.includes('=', 3)) {
			// e.g. '--foo=bar'
			const equalIndex = arg.indexOf('=');
			const name = arg.slice(2, equalIndex);
			tokens.push({ kind: 'option', name, rawName: `--${name}`, index, value: arg.slice(equalIndex + 1), inlineValue: true });
			continue;
		}

		tokens.push({ kind: 'positional', index, value: arg });
	}

	return tokens;
}

/** A polyfill for `util.parseArgs`. */
export function parseArgs<T extends ParseArgsConfig>(this: typeof process, config?: T): ParseArgsResult<T> {
	const input: ParseArgsConfig = config ?? {};

	const args = objectGetOwn(input, 'args') ?? this.argv.slice(1);
	const strict = objectGetOwn(input, 'strict') ?? true;
	const allowPositionals = objectGetOwn(input, 'allowPositionals') ?? !strict;
	const allowNegative = objectGetOwn(input, 'allowNegative') ?? false;
	const returnTokens = objectGetOwn(input, 'tokens') ?? false;
	const options = objectGetOwn(input, 'options') ?? {};

	// Validate the configuration
	if (!Array.isArray(args)) throw invalidArg('args', 'an instance of Array', args);
	validateBoolean(strict, 'strict');
	validateBoolean(allowPositionals, 'allowPositionals');
	validateBoolean(returnTokens, 'tokens');
	validateBoolean(allowNegative, 'allowNegative');
	if (typeof options != 'object' || options === null || Array.isArray(options)) throw invalidArg('options', 'of type object', options);

	for (const [longOption, optionConfig] of Object.entries(options)) {
		const name = `options.${longOption}`;
		if (typeof optionConfig != 'object' || optionConfig === null || Array.isArray(optionConfig)) throw invalidArg(name, 'of type object', optionConfig);

		// `type` is required
		const type = objectGetOwn(optionConfig, 'type');
		if (type !== 'string' && type !== 'boolean') throw invalidArg(`${name}.type`, "one of: 'string', 'boolean'", type);

		if (Object.hasOwn(optionConfig, 'short')) {
			const short = optionConfig.short;
			if (typeof short != 'string') throw invalidArg(`${name}.short`, 'of type string', short);
			if (short.length != 1) throw parseArgsError('ERR_INVALID_ARG_VALUE', `The property '${name}.short' must be a single character. Received ${display(short)}`);
		}

		const multiple = objectGetOwn(optionConfig, 'multiple');
		if (Object.hasOwn(optionConfig, 'multiple')) validateBoolean(multiple, `${name}.multiple`);

		const value = objectGetOwn(optionConfig, 'default');
		if (value === undefined) continue;

		const valid = multiple ? Array.isArray(value) && value.every(entry => typeof entry == type) : typeof value == type;
		if (!valid) throw invalidArg(`${name}.default`, multiple ? `an instance of ${type}[]` : `of type ${type}`, value);
	}

	const tokens = argsToTokens(args, options);

	const values: Record<string, OptionValue | OptionValue[]> = Object.create(null) as Record<string, OptionValue | OptionValue[]>;
	const positionals: string[] = [];

	for (const token of tokens) {
		switch (token.kind) {
			case 'option': {
				if (strict) {
					// check option usage
					let name = token.name;

					if (!Object.hasOwn(options, name)) {
						// Check for a negated boolean option, e.g. `--no-foo`
						const positiveName = allowNegative && name.startsWith('no-') ? name.slice(3) : undefined;
						if (positiveName === undefined || optionsGetOwn(options, positiveName, 'type') != 'boolean') {
							const suggestDashDash = allowPositionals
								? `. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- ${JSON.stringify(token.rawName)}`
								: '';
							throw parseArgsError('ERR_PARSE_ARGS_UNKNOWN_OPTION', `Unknown option '${token.rawName}'${suggestDashDash}`);
						}
						name = positiveName;
					}

					const short = optionsGetOwn(options, name, 'short');
					const shortAndLong = `${short ? `-${short}, ` : ''}--${name}`;
					const type = optionsGetOwn(options, name, 'type');

					if (type == 'string' && typeof token.value != 'string')
						throw parseArgsError('ERR_PARSE_ARGS_INVALID_OPTION_VALUE', `Option '${shortAndLong} <value>' argument missing`);
					if (type == 'boolean' && token.value != null) throw parseArgsError('ERR_PARSE_ARGS_INVALID_OPTION_VALUE', `Option '${shortAndLong}' does not take an argument`);

					// check option usage
					if (!token.inlineValue && token.value != null && token.value.length > 1 && token.value.charAt(0) == '-') {
						// Only show a short example if the user used a short option.
						const example = token.rawName.startsWith('--') ? `'${token.rawName}=-XYZ'` : `'--${token.name}=-XYZ' or '${token.rawName}-XYZ'`;

						throw parseArgsError(
							'ERR_PARSE_ARGS_INVALID_OPTION_VALUE',
							`Option '${token.rawName}' argument is ambiguous.
Did you forget to specify the option argument for '${token.rawName}'?
To specify an option argument starting with a dash use ${example}.`
						);
					}
				}

				let name = token.name;
				let value: OptionValue | undefined = token.value;

				if (name == '__proto__') break;

				if (allowNegative && name.startsWith('no-') && value === undefined) {
					// Boolean option negation: --no-foo
					name = name.slice(3);
					token.name = name;
					value = false;
				}

				const newValue = value ?? true;

				if (!optionsGetOwn(options, name, 'multiple')) {
					values[name] = newValue;
					break;
				}

				const existing = values[name];
				if (Array.isArray(existing)) existing.push(newValue);
				else values[name] = [newValue];

				break;
			}
			case 'positional':
				if (!allowPositionals)
					throw parseArgsError('ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL', `Unexpected argument '${token.value}'. This command does not take positional arguments`);
				positionals.push(token.value);
				break;
		}
	}

	// Phase 3: fill in default values for missing args
	for (const [longOption, optionConfig] of Object.entries(options)) {
		const value = objectGetOwn(optionConfig, 'default');
		if (value === undefined || values[longOption] !== undefined || longOption == '__proto__') continue;
		values[longOption] = value;
	}

	return { values, positionals, ...(returnTokens && { tokens }) } as unknown as ParseArgsResult<T>;
}

export interface InspectOptions {
	depth?: number | null;
	quoteStrings?: boolean;
}

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quote(text: string): string {
	const q = !text.includes("'") ? "'" : !text.includes('"') ? '"' : '`';
	return (
		q +
		text
			.replaceAll('\\', '\\\\')
			.replaceAll(q, '\\' + q)
			.replaceAll('\n', '\\n') +
		q
	);
}

function prefixOf(value: object): string {
	const name = Object.getPrototypeOf(value) === null ? '[Object: null prototype]' : (value.constructor?.name ?? '');
	return !name || name == 'Object' ? (name == 'Object' ? '' : name) : name + ' ';
}

function entries(value: object, seen: Set<object>, depth: number, options: InspectOptions): string[] {
	return Object.entries(value).map(([key, v]) => `${identifier.test(key) ? key : quote(key)}: ${_inspect(v, seen, depth, options)}`);
}

function wrap(prefix: string, open: string, parts: string[], close: string, depth: number): string {
	if (!parts.length) return prefix + open + close;

	const line = `${prefix}${open} ${parts.join(', ')} ${close}`;
	if (line.length <= 72 && !line.includes('\n')) return line;

	const indent = '  '.repeat(depth + 1);
	return `${prefix}${open}\n${parts.map(part => indent + part.replaceAll('\n', '\n  ')).join(',\n')}\n${'  '.repeat(depth)}${close}`;
}

function _inspect(value: unknown, seen: Set<object>, depth: number, options: InspectOptions): string {
	switch (typeof value) {
		case 'string':
			return options.quoteStrings === false && !depth ? value : quote(value);
		case 'bigint':
			return value + 'n';
		case 'symbol':
			return value.toString();
		case 'function': {
			const kind = /^class[\s{]/.test(Function.prototype.toString.call(value)) ? 'class' : 'Function';
			return value.name ? `[${kind}: ${value.name}]` : `[${kind} (anonymous)]`;
		}
		case 'undefined':
			return 'undefined';
		case 'number':
			return Object.is(value, -0) ? '-0' : String(value);
		case 'boolean':
			return String(value);
	}

	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (seen.has(value)) return '[Circular *1]';

	if (Error.isError(value)) return value.stack ?? `${value.name}: ${value.message}`;
	if (value instanceof Date) return isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
	if (value instanceof RegExp) return String(value);

	const max = options.depth === null ? Infinity : (options.depth ?? 2);
	if (depth > max) return Array.isArray(value) ? '[Array]' : '[Object]';

	seen.add(value);
	try {
		if (Array.isArray(value)) {
			const parts = value.map(v => _inspect(v, seen, depth + 1, options));
			// Anything set on the array itself, e.g. `Object.assign([1], { a: 2 })`
			for (const [key, v] of Object.entries(value)) {
				if (!/^\d+$/.test(key)) parts.push(`${identifier.test(key) ? key : quote(key)}: ${_inspect(v, seen, depth + 1, options)}`);
			}
			return wrap('', '[', parts, ']', depth);
		}

		if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
			const items = Array.from(value as unknown as ArrayLike<number | bigint>, v => (typeof v == 'bigint' ? v + 'n' : String(v)));
			return wrap(value.constructor.name + '(' + items.length + ') ', '[', items, ']', depth);
		}

		if (value instanceof Map) {
			const parts = [...value].map(([k, v]) => `${_inspect(k, seen, depth + 1, options)} => ${_inspect(v, seen, depth + 1, options)}`);
			return wrap(`Map(${value.size}) `, '{', parts, '}', depth);
		}

		if (value instanceof Set) {
			const parts = [...value].map(v => _inspect(v, seen, depth + 1, options));
			return wrap(`Set(${value.size}) `, '{', parts, '}', depth);
		}

		if (value instanceof Promise) return 'Promise { <pending> }';

		return wrap(prefixOf(value), '{', entries(value, seen, depth + 1, options), '}', depth);
	} finally {
		seen.delete(value);
	}
}

export function inspect(value: unknown, options: InspectOptions = {}): string {
	return _inspect(value, new Set(), 0, options);
}

const specifiers = /%[sdifjoOc%]/g;

export function format(...args: unknown[]): string {
	const parts: string[] = [];
	let rest = args;

	if (typeof args[0] == 'string' && args[0].includes('%')) {
		const [template, ...values] = args as [string, ...unknown[]];
		let next = 0;

		parts.push(
			template.replace(specifiers, match => {
				if (match == '%%') return '%';
				if (next >= values.length) return match;

				const value = values[next++];
				switch (match) {
					case '%s':
						return typeof value == 'object' && value !== null ? inspect(value, { depth: 0 }) : typeof value == 'bigint' ? value + 'n' : String(value);
					case '%d':
						return typeof value == 'bigint' || typeof value == 'symbol' ? String(value) : String(Number(value));
					case '%i':
						return typeof value == 'bigint' || typeof value == 'symbol' ? String(value) : String(parseInt(String(value), 10));
					case '%f':
						return typeof value == 'symbol' ? String(value) : String(parseFloat(String(value)));
					case '%j':
						try {
							return JSON.stringify(value) ?? 'undefined';
						} catch {
							return '[Circular]';
						}
					case '%o':
						return inspect(value, { depth: 4 });
					case '%O':
						return inspect(value);
					// CSS, which a terminal has no use for
					case '%c':
						return '';
				}
				return match;
			})
		);

		rest = values.slice(next);
	}

	for (const value of rest) parts.push(typeof value == 'string' ? value : inspect(value));

	return parts.join(' ');
}
