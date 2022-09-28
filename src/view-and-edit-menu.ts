import { Disposable, ProgressLocation, QuickPickItem, window, env } from 'vscode';
import { assertIsErrorLike } from './error';
import { ISettings } from './pick';
import { Resource } from './resource';
import { showInputBoxWithJSONValidation } from './input-box';
import { toSentenceCase } from './tools/case';

interface ActionItem extends QuickPickItem {
  readonly action: (item: ActionItem) => { finished: boolean } | PromiseLike<{ finished: boolean }>;
}

export interface IValueRepository {
  retrieveValue(): Promise<string | undefined>;
  updateValue(value: string): Promise<void>;
}

type ShowSecretMenuParams = {
  secret: Resource;
  settings: ISettings;
  kind: 'secret' | 'parameter';
  valueRepository: IValueRepository;
};
export async function showViewAndEditMenu({
  secret,
  settings: _,
  kind,
  valueRepository: valueCRUD,
}: ShowSecretMenuParams): Promise<{ finished: boolean }> {
  const picker = window.createQuickPick<ActionItem>();
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
    picker.placeholder = `${toSentenceCase(kind)}: ${secret.name}`;
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
          label: `$(copy) Copy value`,
          description: displayedValue,
          action: async () => copyToClipAndNotify(await actualValuePromise, 'value'),
        },
        {
          label: `$(copy) Copy name`,
          description: secret.name,
          action: item => copyToClipAndNotify(item.description, 'name'),
        },
        {
          label: `$(copy) Copy ARN`,
          description: secret.arn,
          action: item => copyToClipAndNotify(item.description, 'ARN'),
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
      picker.items = items;
      if (activeItemLabels.size > 0) {
        picker.activeItems = picker.items.filter(item => activeItemLabels.has(item.label));
      }
    }

    async function editValue(value: string | undefined): Promise<{ finished: boolean }> {
      const editedValue = await showInputBoxWithJSONValidation(value, toSentenceCase(`${kind} value`));
      if (!editedValue) return { finished: false }; // Cancelled?

      try {
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: `Updating ${kind}: ${secret.name} ...`,
          },
          async progress => {
            progress.report({ increment: 0 });
            await valueCRUD.updateValue(editedValue);
            progress.report({ increment: 100 });
          },
        );
        await window.showInformationMessage(`Updated ${kind} for: ${secret.name}`);
        return { finished: true };
      } catch (e) {
        assertIsErrorLike(e);
        await window.showErrorMessage(`Failed to store ${kind}: ${e.message}`);
        return { finished: false };
      }
    }

    async function copyToClipAndNotify(description: string | undefined, what: string): Promise<{ finished: boolean }> {
      if (description) {
        await env.clipboard.writeText(description);
        window.showInformationMessage(`Copied ${what} to clipboard`);
        return { finished: true };
      } else {
        window.showWarningMessage('Nothing to copy');
        return { finished: false };
      }
    }
  });
}
