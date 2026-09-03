declare global {
	/**
	 * Opens the GUI text editor
	 * @internal
	 */
	function __editor_open(path: string): Promise<void>;
}

/**
 * Interface for the script locals
 */
export interface ExecutionLocals {
	/* Internal */
	__editor_open: typeof __editor_open;
}
