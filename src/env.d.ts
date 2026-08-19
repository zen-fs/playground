declare module '*.css' {
	const content: string;
	export default content;
}

declare module '@babel/traverse' {
	export interface Visitor {
		[key: string]: unknown;
	}
}

declare module '@babel/generator' {
	export interface GeneratorOptions {
		[key: string]: unknown;
	}
}
