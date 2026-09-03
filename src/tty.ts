import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import type { TTY } from '@zenfs/linux';
import { attach_xterm } from '@zenfs/linux';
import $ from 'jquery';

// No `convertEol`: ONLCR in the tty's line discipline already turns NL into CR-NL
export const terminal = new Terminal({ rows: 48 });
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.open($('#terminal-container')[0]);

onload = () => fitAddon.fit();
onresize = () => fitAddon.fit();

/** The terminal's tty, i.e. `/dev/xterm0`. Only set once `attach_terminal` has run. */
export let tty: TTY | undefined;

/**
 * Hand the page's terminal to the tty layer and make it the console, so `/dev/tty` and `/dev/console` reach it too.
 */
export function attach_terminal(): void {
	tty = attach_xterm(terminal);
}
