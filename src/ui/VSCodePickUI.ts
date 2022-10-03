import { env, QuickPick, QuickPickItem, QuickPickItemKind, ThemeIcon, Uri, window } from 'vscode';
import { IPickUI } from '../pick';
import { SeparatorItem } from './interfaces';

const CLEAR = new ThemeIcon('search-remove');
const SEPARATOR: SeparatorItem = { label: '', kind: QuickPickItemKind.Separator, variant: 'separator' };

export class VSCodePickUI implements IPickUI {
  async showErrorMessage(message: string): Promise<void> {
    await window.showErrorMessage(message);
  }

  createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
    return window.createQuickPick();
  }

  async openUrl(url: string): Promise<boolean> {
    return await env.openExternal(Uri.parse(url));
  }

  readonly clearIcon = CLEAR;
  readonly separator = SEPARATOR;
}
