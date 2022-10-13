import { FileSystemWatcher, QuickPickItem, ThemeIcon } from 'vscode';
import { IInputUI } from './input';
import { IPickUI } from './pick';
import { IProfileUI } from './profile';
import { IViewAndEditUI } from './view-and-edit-menu';

export interface ISettings {
  /** Selected profile */
  readonly profile: string | undefined;
  setProfile(profile: string): Promise<void>;
  readonly region: string | undefined;
  setRegion(region: string): Promise<void>;
  readonly configFilepath: string;
  enumerateProfileNames(): string[] | undefined;
  isProfileName(name: string): boolean;
  dispose(): void;
}

export enum MessageTypes {
  'info',
  'warn',
  'error',
}

export interface IUIFactory {
  makeProfileUI(): IProfileUI;
  makePickUI(): IPickUI;
  makeInputUI(): IInputUI;
  makeViewAndEditUI(): IViewAndEditUI;
  makeBasicUI(): IBasicUI;
}

export interface IBasicUI {
  showMessage(type: MessageTypes, message: string): Promise<void>;
  withProgress(title: string, action: () => Promise<void>): Promise<void>;
  pickString(values: string[], placeHolder?: string, title?: string): Promise<string | undefined>;
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

export interface ITextMRU {
  /** Get recently selected strings. */
  getRecentlySelected(): string[];

  /** Register a string as having been selected. */
  notifySelected(text: string): Promise<void>;

  /** Clear a string as having been selected. */
  clearRecent(text: string): Promise<void>;

  /** Is string in recently selected set? */
  isRecent(text: string): boolean;

  /** Gets the index of the MRU string. */
  indexOf(text: string): number;
}
