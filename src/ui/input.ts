import type { Disposable, InputBox } from 'vscode';
import { assertIsErrorLike } from '../tools/error';
import { IUIFactory } from './interfaces';

export interface IInputUI {
  createInputBox(): InputBox;
}

export type InputParams = {
  initialValue?: string;
  title?: string;
  placeholder?: string;
  uiFactory: IUIFactory;
  validate?: (value: string) => string | undefined;
  step?: { step: number; totalSteps: number };
};
export function input({
  initialValue = '',
  placeholder,
  uiFactory,
  validate,
  step,
  title,
}: InputParams): Promise<string | undefined> {
  const ui = uiFactory.makeInputUI();

  return new Promise<string | undefined>(resolve => {
    const disposables: Disposable[] = [];
    const input = ui.createInputBox();
    input.ignoreFocusOut = true;
    input.value = initialValue;
    input.placeholder = placeholder;
    (input.title = title), input.show();
    input.onDidAccept(onDidAccept, undefined, disposables);
    input.onDidHide(onDidHide, undefined, disposables);
    input.onDidChangeValue(onDidChangeValue, undefined, disposables);

    if (step) {
      input.step = step.step;
      input.totalSteps = step.totalSteps;
    }

    function getValidationMessage(value: string): string | undefined {
      return validate?.(value);
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
      if (dispose()) resolve(undefined);
    }

    function dispose(): boolean {
      const numDisposables = disposables.length;
      disposables.forEach(d => d.dispose());
      disposables.length = 0;
      return numDisposables > 0;
    }
  });
}

export function validateJSON(value: string): string | undefined {
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
