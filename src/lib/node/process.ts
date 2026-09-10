/**
 * Node's `process`, for a process on its own thread.
 *
 * Everything it used to read off a kernel `Process` is a syscall now. Signals are the one thing that
 * genuinely changed shape: the kernel is told which ones this process handles, and the handlers run
 * on the way back out of whatever syscall the signal interrupted.
 */
import type { SignalName } from '@zenfs/linux';
import { off_signal, on_signal } from '@zenfs/linux/uapi/base';
import { chdir, getcwd } from '@zenfs/linux/uapi/fs';
import * as sys from '@zenfs/linux/uapi/process';
import { ReadStream, WriteStream } from './tty.js';

/** The signals, by name, so `process.on('SIGINT', ...)` still works */
const signals: Record<string, number> = {
	SIGHUP: 1,
	SIGINT: 2,
	SIGQUIT: 3,
	SIGILL: 4,
	SIGTRAP: 5,
	SIGABRT: 6,
	SIGBUS: 7,
	SIGFPE: 8,
	SIGKILL: 9,
	SIGUSR1: 10,
	SIGSEGV: 11,
	SIGUSR2: 12,
	SIGPIPE: 13,
	SIGALRM: 14,
	SIGTERM: 15,
	SIGCHLD: 17,
	SIGCONT: 18,
	SIGSTOP: 19,
	SIGTSTP: 20,
	SIGWINCH: 28,
};

function signal_of(event: string): number {
	const signal = signals[event];
	if (signal === undefined) throw new Error(`process events other than signals are not supported ('${event}')`);
	return signal;
}

export type Listener = (name: SignalName, signal: number) => void;

/** The wrappers actually handed to the kernel, so `off` can take the right one back off */
const installed = new Map<Listener, Map<number, (signal: number) => void>>();

function install(event: string, listener: Listener, once: boolean): void {
	const signal = signal_of(event);

	const wrapper = (raised: number) => {
		if (once) off(event, listener);
		listener(event as SignalName, raised);
	};

	let byEvent = installed.get(listener);
	if (!byEvent) installed.set(listener, (byEvent = new Map()));
	byEvent.set(signal, wrapper);

	on_signal(signal, wrapper);
}

function off(event: string, listener: Listener): void {
	const signal = signal_of(event);
	const wrapper = installed.get(listener)?.get(signal);
	off_signal(signal, wrapper);
	installed.get(listener)?.delete(signal);
}

export const stdin: ReadStream = new ReadStream(0);
export const stdout: WriteStream = new WriteStream(1);
export const stderr: WriteStream = new WriteStream(2);

export const process = {
	platform: 'linux' as const,
	get pid(): number {
		return sys.getpid();
	},
	get ppid(): number {
		return sys.getppid();
	},
	getuid: (): number => sys.getuid(),
	geteuid: (): number => sys.geteuid(),
	getgid: (): number => sys.getgid(),
	getegid: (): number => sys.getegid(),
	get argv(): string[] {
		return sys.argv();
	},
	get env(): Record<string, string> {
		return sys.environ();
	},
	stdin,
	stdout,
	stderr,
	cwd: (): string => getcwd(),
	chdir: (directory: string): void => chdir(directory),
	exit: (code?: number): never => sys.exit(code ?? 0),
	on(event: string, listener: Listener) {
		install(event, listener, false);
		return process;
	},
	once(event: string, listener: Listener) {
		install(event, listener, true);
		return process;
	},
	off(event: string, listener: Listener) {
		off(event, listener);
		return process;
	},
	removeListener(event: string, listener: Listener) {
		return process.off(event, listener);
	},
	removeAllListeners(event?: string) {
		if (event) off_signal(signal_of(event));
		else for (const [, byEvent] of installed) for (const signal of byEvent.keys()) off_signal(signal);
		installed.clear();
		return process;
	},
	kill: (pid: number, signal: SignalName | number = 'SIGTERM'): void => sys.kill(pid, typeof signal == 'number' ? signal : signal_of(signal)),
};

export default process;
