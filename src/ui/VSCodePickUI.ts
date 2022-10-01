import { QuickPick, QuickPickItem, window } from 'vscode';
import { IPickUI } from '../pick';

export class VSCodePickUI implements IPickUI {
  async showErrorMessage(message: string): Promise<void> {
    await window.showErrorMessage(message);
  }

  createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
    return window.createQuickPick();
  }
}
