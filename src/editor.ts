import $ from 'jquery';

$<HTMLTextAreaElement>('#editor .content').on('keydown', e => {
	if (e.key != 'Tab') {
		return;
	}
	e.preventDefault();

	const start = e.target.selectionStart;

	// set textarea value to: text before caret + tab + text after caret
	e.target.value = e.target.value.slice(0, start) + '\t' + e.target.value.slice(e.target.selectionEnd);

	// put caret at right position again
	e.target.selectionStart = e.target.selectionEnd = start + 1;
});
