import { FileSystemWatcher, QuickPickItem, ThemeIcon } from 'vscode';
import { IPickUI } from '../pick';
import { IProfileUI } from '../profile';

export interface IUIFactory {
  makeProfileUI(): IProfileUI;
  makePickUI(): IPickUI;
}

export interface IKeyValueStorage {
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: any): Promise<void>;
}

export interface IFileSystem {
  readTextFile(filename: string): string | undefined;
  watchFile(filename: string): FileSystemWatcher;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FakeThemeIcon extends ThemeIcon {}

export interface SeparatorItem extends QuickPickItem {
  variant: 'separator';
}
