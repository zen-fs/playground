import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { define_device_tree } from '@zenfs/linux';
import $ from 'jquery';

const terminal = new Terminal({ rows: 48 });
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());
terminal.open($('#terminal-container')[0]);

onload = () => fitAddon.fit();
onresize = () => fitAddon.fit();

define_device_tree({ kind: 'xterm', terminal });
