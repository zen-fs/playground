import * as path from '@zenfs/core/path';
import { getcwd } from '@zenfs/linux/uapi/fs';

export { basename, dirname, extname, format, isAbsolute, join, normalize, parse, sep } from '@zenfs/core/path';

export function resolve(...parts: (string | undefined)[]): string {
	return path.resolve.call({ pwd: getcwd() }, ...parts);
}

export function relative(from: string, to: string): string {
	return path.relative.call({ pwd: getcwd() }, from, to);
}

export default { ...path, resolve, relative };
