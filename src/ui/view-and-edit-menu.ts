import type { Disposable, QuickPick, QuickPickItem } from 'vscode';
import { Resource } from '../model/resource';
import { toSentenceCase } from '../tools/case';
import { assertIsErrorLike } from '../tools/error';
import { MessageTypes } from '../vscode/VSCodeViewAndEditUI';
import { input } from './input';
import { ISettings, IUIFactory } from './interfaces';

interface ActionItem extends QuickPickItem {
  readonly action: (item: ActionItem) => { finished: boolean } | PromiseLike<{ finished: boolean }>;
}

export interface IValueRepository {
  createValue(name: string, value: string): Promise<void>;
  retrieveValue(): Promise<string | undefined>;
  updateValue(value: string): Promise<void>;
}

export interface IViewAndEditUI {
  createQuickPick<T extends QuickPickItem>(): QuickPick<T>;
  showMessage(message: string, type?: MessageTypes): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  openUrl(url: string): Promise<boolean>;
  withProgress(title: string, action: () => Promise<void>): Promise<void>;
}

type ShowSecretMenuParams = {
  resource: Resource;
  settings: ISettings;
  kind: 'secret' | 'parameter';
  valueRepository: IValueRepository;
  uiFactory: IUIFactory;
};
export async function showViewAndEditMenu({
  resource,
  settings: _,
  kind,
  valueRepository: valueCRUD,
  uiFactory,
}: ShowSecretMenuParams): Promise<{ finished: boolean }> {
  const ui = uiFactory.makeViewAndEditUI();
  const picker = ui.createQuickPick<ActionItem>();
  picker.busy = true;

  return new Promise(async resolve => {
    const disposables: Disposable[] = [];

    function onDidHide() {
      if (dispose()) resolve({ finished: false });
    }

    async function onDidAccept() {
      const item = picker.selectedItems[0];
      if (!item) return;

      if (dispose()) {
        const finished = await item.action(item);
        if (finished) {
          resolve({ finished: true });
          picker.hide();
        } else {
          picker.show();
        }
      }
    }

    function dispose(): boolean {
      const numDisposables = disposables.length;
      disposables.forEach(d => d.dispose());
      disposables.length = 0;
      return numDisposables > 0;
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.show();
    picker.placeholder = `${toSentenceCase(kind)}: ${resource.name}`;
    render();

    let actualValuePromise: Promise<string | undefined>;
    try {
      actualValuePromise = valueCRUD.retrieveValue();
      render(await actualValuePromise);
    } catch (e) {
      assertIsErrorLike(e);
      render(`Failed to load value: ${e.message}`);
    } finally {
      picker.busy = false;
    }

    function render(value?: string) {
      const activeItemLabels = new Set(picker.activeItems.map(item => item.label));
      picker.keepScrollPosition = true;
      const displayedValue = value ?? 'Retrieving value...';
      const items: ActionItem[] = [
        {
          label: `$(variable) Copy value`,
          description: displayedValue,
          action: async () => copyToClipAndNotify(await actualValuePromise, 'value'),
        },
        {
          label: `$(symbol-text) Copy name`,
          description: resource.name,
          action: () => copyToClipAndNotify(resource.name, 'name'),
        },
        {
          label: `$(tag) Copy ARN`,
          description: resource.arn,
          action: () => copyToClipAndNotify(resource.arn, 'ARN'),
        },
        {
          label: `$(link) Open in AWS...`,
          action: () => showURL(resource.url),
        },
        {
          label: `$(pencil) Edit value...`,
          description: displayedValue,
          action: async () => {
            const { finished } = await editValue(await actualValuePromise);
            return { finished };
          },
        },
      ];

      // Some resources, such as parameters, don't have an ARN.
      if (!resource.arn) {
        const copyARNIndex = items.findIndex(item => item.label.endsWith('Copy ARN'));
        items.splice(copyARNIndex, 1);
      }

      picker.items = items;
      if (activeItemLabels.size > 0) {
        picker.activeItems = picker.items.filter(item => activeItemLabels.has(item.label));
      }
    }

    async function editValue(value: string | undefined): Promise<{ finished: boolean }> {
      const editedValue = await input({
        initialValue: value,
        placeholder: toSentenceCase(`${kind} value`),
        validate: validateJSON,
        uiFactory,
      });
      if (!editedValue) return { finished: false }; // Cancelled?

      try {
        await ui.withProgress(`Saving ${kind}: ${resource.name}`, () => valueCRUD.updateValue(editedValue));
        return { finished: true };
      } catch (e) {
        assertIsErrorLike(e);
        await ui.showMessage(`Failed to store ${kind}: ${e.message}`, 'error');
        return { finished: false };
      }
    }

    async function copyToClipAndNotify(description: string | undefined, what: string): Promise<{ finished: boolean }> {
      if (description) {
        await ui.copyToClipboard(description);
        await ui.showMessage(`Copied ${what} to clipboard`);
        return { finished: true };
      } else {
        await ui.showMessage('Nothing to copy', 'warn');
        return { finished: false };
      }
    }
  });

  async function showURL(url: string): Promise<{ finished: boolean }> {
    await ui.openUrl(url);
    return { finished: true };
  }
}

function validateJSON(value: string): string | undefined {
  if (value.trimStart().startsWith('{')) {
    try {
      JSON.parse(value);
    } catch (e) {
      assertIsErrorLike(e);
      return `Invalid JSON: ${e.message}`;
    }
  }

  return undefined;
}
