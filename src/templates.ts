import $ from 'jquery';

export function instantiateTemplate(selector: string): JQuery<DocumentFragment> {
	return $($<HTMLTemplateElement>(selector)[0].content.cloneNode(true) as DocumentFragment);
}
