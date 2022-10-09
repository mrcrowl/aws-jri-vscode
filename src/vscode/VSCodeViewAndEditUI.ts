import { env, ProgressLocation, QuickPick, QuickPickItem, Uri, window } from 'vscode';
import { sleep } from '../tools/async';
import { IViewAndEditUI } from '../ui/view-and-edit-menu';

export type MessageTypes = 'info' | 'warn' | 'error';

export class VSCodeViewAndEditUI implements IViewAndEditUI {
  async showMessage(message: string, type?: MessageTypes): Promise<void> {
    switch (type) {
      case 'error':
        await window.showErrorMessage(message);
        return;
      case 'warn':
        await window.showWarningMessage(message);
        return;
      case 'info':
      default:
        await window.showInformationMessage(message);
        return;
    }
  }

  async showInformationMessage(message: string): Promise<void> {
    await window.showInformationMessage(message);
  }

  createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
    return window.createQuickPick();
  }

  async openUrl(url: string): Promise<boolean> {
    return await env.openExternal(Uri.parse(url));
  }

  async copyToClipboard(text: string): Promise<void> {
    await env.clipboard.writeText(text);
  }

  async withProgress(title: string, action: () => Promise<void>): Promise<void> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title,
      },
      async progress => {
        progress.report({ increment: 0, message: '...' });
        try {
          await action();
          progress.report({ increment: 100, message: '✅' });
        } catch (e) {
          progress.report({ increment: 100, message: '❌' });
        } finally {
          await sleep(1500);
          progress.report({ increment: 100 });
        }
      },
    );
  }
}
