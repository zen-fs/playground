import type { Terminal } from '@xterm/xterm';
import type { createShell, ShellOptions, ShellContext } from 'utilium/shell.js';

declare global {
	/**
	 * The xterm.js terminal
	 */
	const terminal: Terminal;

	/**
	 * Opens the GUI text editor
	 * @internal
	 */
	function __editor_open(path: string): Promise<void>;

	function exec(filename: string, args: string[], env: Record<string, string | undefined>): Promise<void>;

	function createShell(options: ShellOptions): ShellContext;

	function $load(specifier: string): any;
}

/**
 * Interface for the script locals
 */
export interface ExecutionLocals {
	terminal: typeof terminal;

	/* Internal */
	__editor_open: typeof __editor_open;
	createShell: typeof createShell;
}
