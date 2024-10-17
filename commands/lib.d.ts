import type { fs as _fs, resolveMountConfig } from '@zenfs/core';
import type * as _path from '@zenfs/core/emulation/path.js';
import type { Terminal } from '@xterm/xterm';

declare global {
	/**
	 * Command line arguments. args[0] is the command name
	 */
	const args: string[];
	/**
	 * The xterm.js terminal
	 */
	const terminal: Terminal;

	/**
	 * Opens the GUI text editor
	 * @internal
	 */
	function __editor_open(path: string): Promise<void>;

	/**
	 * Changes the pwd to `path` if `path` is a getDirector
	 * If `path` isn't a directory and `dirOnly` is `true`, throws an error.
	 * Otherwise, it opens `path` in the GUI text editor
	 * @internal
	 */
	function __open(path: string, dirOnly?: boolean): void;

	/**
	 * Resolves a mount with the given configuration
	 * @internal
	 */
	const __mount_resolve: typeof resolveMountConfig;

	// Libraries
	const fs: typeof _fs;
}

/**
 * Interface for the script locals
 */
export interface ExecutionLocals {
	args: typeof args;
	terminal: typeof terminal;

	/* Libraries */
	fs: typeof fs;

	/* Internal */
	__editor_open: typeof __editor_open;
	__open: typeof __open;
	__mount_resolve: typeof __mount_resolve;
}
