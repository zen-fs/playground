import { binfmts, set_thread_entry } from '@zenfs/linux';

/** The built `src/runtime.ts`, which the thread imports before the program */
const runtime = new URL('./system/runtime.js', location.href).href;

/** The built `@zenfs/linux/uapi/bootstrap.js`, which is where a thread starts */
const bootstrap = new URL('./system/bootstrap.js', location.href);

export function binfmt_nodejs_init(): void {
	set_thread_entry(bootstrap);

	for (const fmt of binfmts) {
		if (fmt.name == 'js') fmt.runtime = runtime;
	}
}
