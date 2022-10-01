import { Disposable, FileSystemWatcher, Uri } from 'vscode';
import { IKeyValueStorage } from '../ui/interfaces';

export class FakeStorage implements IKeyValueStorage {
  private readonly storedValues = new Map<string, unknown>();

  clear() {
    this.storedValues.clear();
  }

  get<T>(key: string, defaultValue: T): T {
    return (this.storedValues.get(key) as T) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storedValues.set(key, value);
  }
}

export class FakeFileSystemWatcher implements FileSystemWatcher {
  ignoreCreateEvents = false;
  ignoreChangeEvents = false;
  ignoreDeleteEvents = true;
  #onDidChangeListener: ((e: Uri) => any) | undefined;
  #onDidCreateListener: ((e: Uri) => any) | undefined;
  fireOnDidChange = (uri: Uri) => this.#onDidChangeListener?.(uri);
  fireOnDidCreate = (uri: Uri) => this.#onDidCreateListener?.(uri);
  dispose = () => {};

  onDidChange(listener: (e: Uri) => any, thisArgs?: any, disposables?: Disposable[]): Disposable {
    this.#onDidChangeListener = listener.bind(thisArgs);
    const disposable = { dispose: () => {} };
    disposables?.push(disposable);
    return disposable;
  }

  onDidCreate(listener: (e: Uri) => any, thisArgs?: any, disposables?: Disposable[]): Disposable {
    this.#onDidCreateListener = listener.bind(thisArgs);
    const disposable = { dispose: () => {} };
    disposables?.push(disposable);
    return disposable;
  }

  onDidDelete(): Disposable {
    throw new Error('onDidDelete is not implemented.');
  }
}
