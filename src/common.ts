import { cd as _cd, cwd } from '@zenfs/core/emulation/path.js';
import $ from 'jquery';

export function cd(dir: string) {
	_cd(dir);
	$('#location').val(cwd);
}
