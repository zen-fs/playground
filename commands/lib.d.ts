import type { fs as _fs } from '@zenfs/core';
import type * as _path from '@zenfs/core/emulation/path.js';
import type _chalk from 'chalk';
import type { Terminal } from '@xterm/xterm';
import type * as _utilium from 'utilium';

declare global {
	const args: string[];
	const terminal: Terminal;
	const fs: typeof _fs;
	const path: typeof _path;
	const chalk: typeof _chalk;
	const utilium: typeof _utilium;
	function __editor_open(path: string): Promise<void>;
	function __open(path: string, dirOnly?: boolean): void;
}

export interface ExecutionLocals {
	args: string[];
	terminal: Terminal;
	fs: typeof _fs;
	path: typeof _path;
	chalk: typeof _chalk;
	utilium: typeof _utilium;
	__editor_open(this: void, path: string): Promise<void>;
	__open(this: void, path: string, dirOnly?: boolean): void;
}
