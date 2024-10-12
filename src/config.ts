import type { FileSystem } from '@zenfs/core';

/**
 * This maps IDs to instances, for use when remounting.
 */
export const fileSystems = new Map<string, FileSystem>();

export function update() {}
