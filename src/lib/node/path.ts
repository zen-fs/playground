import * as path from '@zenfs/core/path';
import { getcwd } from '@zenfs/linux/uapi/fs';

export { basename, dirname, extname, format, isAbsolute, join, normalize, parse, sep } from '@zenfs/core/path';

export function resolve(...parts: (string | undefined)[]): string {
	return path.resolve(getcwd(), ...parts);
}

export function relative(from: string, to: string): string {
	return path.relative(resolve(from), resolve(to));
}

export default { ...path, resolve, relative };
