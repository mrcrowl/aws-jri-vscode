import type { Disposable, InputBox } from 'vscode';
import { IUIFactory } from './interfaces';

export interface IInputUI {
  createInputBox(): InputBox;
}

export type InputParams = {
  initialValue?: string;
  placeholder?: string;
  uiFactory: IUIFactory;
  validate: (value: string) => string | undefined;
};
export function showInputBoxWithJSONValidation({ initialValue = '', placeholder, uiFactory, validate }: InputParams) {
  const ui = uiFactory.makeInputUI();

  return new Promise<string | void>(resolve => {
    const disposables: Disposable[] = [];
    const input = ui.createInputBox();
    input.ignoreFocusOut = true;
    input.value = initialValue;
    input.placeholder = placeholder;
    input.show();
    input.onDidAccept(onDidAccept, undefined, disposables);
    input.onDidHide(onDidHide, undefined, disposables);
    input.onDidChangeValue(onDidChangeValue, undefined, disposables);

    function getValidationMessage(value: string): string | undefined {
      return validate(value);
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
