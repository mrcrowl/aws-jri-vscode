import { Disposable, window } from 'vscode';
import { assertIsErrorLike } from './error';

export function showInputBoxWithJSONValidation(initialValue: string = '', placeholder?: string) {
  return new Promise<string | void>(resolve => {
    const disposables: Disposable[] = [];
    const input = window.createInputBox();
    input.ignoreFocusOut = true;
    input.value = initialValue;
    input.placeholder = placeholder;
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
        const changed = input.value !== initialValue;
        resolve(changed ? input.value : undefined);
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
