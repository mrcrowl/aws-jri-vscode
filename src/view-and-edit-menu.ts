import clipboardy from 'clipboardy';
import { Disposable, ProgressLocation, QuickPickItem, window } from 'vscode';
import { assertIsErrorLike } from './error';
import { ISettings } from './pick';
import { Resource } from './resource';
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
  settings,
  kind,
  valueRepository: valueCRUD,
}: ShowSecretMenuParams): Promise<{ finished: boolean }> {
  console.log(settings);

  const picker = window.createQuickPick<ActionItem>();
  picker.busy = true;

  return new Promise(async resolve => {
    const disposables: Disposable[] = [];

    function onDidHide() {
      // dispose();
      // resolve({ finished: false });
    }

    function dispose() {
      disposables.forEach(d => d.dispose());
    }

    picker.onDidAccept(
      async () => {
        const item = picker.selectedItems[0];
        if (!item) return;

        if (item.action) {
          const finished = await item.action(item);
          if (finished) {
            resolve({ finished: true });
            picker.hide();
          }
        }
      },
      undefined,
      disposables,
    );
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
      const editedValue = await showInput(value);
      if (!editedValue) return { finished: false };
      if (editedValue === value) {
        return { finished: false };
      }

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
        clipboardy.writeSync(description);
        window.showInformationMessage(`Copied ${what} to clipboard`);
        return { finished: true };
      } else {
        window.showWarningMessage('Nothing to copy');
        return { finished: false };
      }
    }
  });
}

function showInput(initialValue: string = '') {
  return new Promise<string | void>(resolve => {
    const disposables: Disposable[] = [];
    const input = window.createInputBox();
    input.ignoreFocusOut = true;
    input.value = initialValue;
    input.show();
    input.onDidAccept(onDidAccept, undefined, disposables);
    input.onDidHide(onDidHide, undefined, disposables);
    input.onDidChangeValue(onDidChangeValue, undefined, disposables);

    function getValidationMessage(value: string): string | undefined {
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

    function onDidChangeValue(value: string) {
      input.validationMessage = getValidationMessage(value);
    }

    function onDidAccept() {
      if (getValidationMessage(input.value)) {
        return;
      }

      if (dispose()) {
        resolve(input.value);
        input.hide();
      }
    }

    function onDidHide() {
      if (dispose()) resolve();
    }

    function dispose(): boolean {
      const numDisposables = disposables.length;
      disposables.forEach(d => d.dispose());
      disposables.length = 0;
      return numDisposables > 0;
    }
  });
}
