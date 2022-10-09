import {
  env,
  InputBox,
  ProgressLocation,
  QuickPick,
  QuickPickItem,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  window,
} from 'vscode';
import { sleep } from '../tools/async';
import { IInputUI } from '../ui/input';
import { IBasicUI, MessageTypes, SeparatorItem } from '../ui/interfaces';
import { IPickUI } from '../ui/pick';
import { IViewAndEditUI } from '../ui/view-and-edit-menu';

const CLEAR = new ThemeIcon('search-remove');
const SEPARATOR: SeparatorItem = { label: '', kind: QuickPickItemKind.Separator, variant: 'separator' };

export class VSCodeUI implements IInputUI, IPickUI, IViewAndEditUI, IBasicUI {
  readonly clearIcon = CLEAR;
  readonly separator = SEPARATOR;

  createInputBox(): InputBox {
    return window.createInputBox();
  }

  async showErrorMessage(message: string): Promise<void> {
    await window.showErrorMessage(message);
  }

  async showNoConfigFoundError(configFilepath: string): Promise<void> {
    await window.showErrorMessage(`No aws config found at:\n${configFilepath}`);
  }

  async showNoProfilesError(configFilepath: string): Promise<void> {
    await window.showErrorMessage(`There are no profiles in:\n${configFilepath}`);
  }

  async pickProfile(profiles: string[]): Promise<string | undefined> {
    return window.showQuickPick(profiles, { placeHolder: 'Pick AWS profile' });
  }

  async pickString(values: string[], placeHolder?: string, title?: string): Promise<string | undefined> {
    return window.showQuickPick(values, { placeHolder, title });
  }

  createQuickPick<T extends QuickPickItem>(): QuickPick<T> {
    return window.createQuickPick();
  }

  async openUrl(url: string): Promise<boolean> {
    return await env.openExternal(Uri.parse(url));
  }

  async showMessage(type: MessageTypes, message: string): Promise<void> {
    switch (type) {
      case MessageTypes.error:
        await window.showErrorMessage(message);
        return;
      case MessageTypes.warn:
        await window.showWarningMessage(message);
        return;
      case MessageTypes.info:
      default:
        await window.showInformationMessage(message);
        return;
    }
  }

  async showInformationMessage(message: string): Promise<void> {
    await window.showInformationMessage(message);
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
