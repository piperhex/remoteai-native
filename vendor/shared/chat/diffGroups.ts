interface DiffFolderGroup<T> {
  directory: string;
  name: string;
  entries: { file: T; index: number }[];
}

/** Preserve source indices so regrouping does not change which diff a file row opens. */
export function groupDiffFiles<T extends { readonly path: string }>(files: readonly T[]): DiffFolderGroup<T>[] {
  const groups = new Map<string, DiffFolderGroup<T>>();
  files.forEach((file, index) => {
    const path = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
    const separator = path.lastIndexOf('/');
    const directory = separator < 0 ? '' : path.slice(0, separator) || '/';
    let group = groups.get(directory);
    if (!group) {
      const name = directory.split('/').pop() || '根目录';
      group = { directory, name, entries: [] };
      groups.set(directory, group);
    }
    group.entries.push({ file, index });
  });
  return [...groups.values()];
}
