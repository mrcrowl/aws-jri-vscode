import { IFileSystem } from './interfaces';
import * as fs from 'fs';
import { assertIsErrorLike } from '../error';
import { FileSystemWatcher, workspace } from 'vscode';

export class NodeFileSystem implements IFileSystem {
  readTextFile(filename: string): string | undefined {
    try {
      return fs.readFileSync(filename, { encoding: 'utf8' });
    } catch (e) {
      assertIsErrorLike(e);
      console.log(`Error reading ${filename}: ${e.message}`);
      return undefined;
    }
  }

  watchFile(filename: string): FileSystemWatcher {
    return workspace.createFileSystemWatcher(filename, false, false, true);
    //                                                   |      |      |
    //                                                 create change delete
  }
}
