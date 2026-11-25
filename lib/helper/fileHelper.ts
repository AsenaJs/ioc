import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Directories that never hold application components. `node_modules` alone is the
 * overwhelming majority of a project's files, and walking it made every boot stat
 * tens of thousands of paths. Dotfolders (`.git`, `.idea`, `.vscode`, ...) are
 * skipped by prefix rather than by name.
 */
const EXCLUDED_DIRECTORIES = new Set(['node_modules']);

const isExcludedDirectory = (name: string): boolean => name.startsWith('.') || EXCLUDED_DIRECTORIES.has(name);

export const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
  // Sorted because `readdirSync` order is not defined: without this, which file wins a
  // name collision - or which config is picked up first - can differ between machines
  const files = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

  files.forEach((file) => {
    const filePath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      if (isExcludedDirectory(file.name)) {
        return;
      }

      getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
};
