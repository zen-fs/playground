import type { ShellOptions, ShellContext } from 'utilium/shell';

declare global {
	/**
	 * Opens the GUI text editor
	 * @internal
	 */
	function __editor_open(path: string): Promise<void>;

	function exec(filename: string, args: string[], env: Record<string, string | undefined>): Promise<void>;

	function createShell(options: Omit<ShellOptions, 'terminal'>): ShellContext;
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
