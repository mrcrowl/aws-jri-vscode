import { InputBox, window } from 'vscode';
import { IInputUI } from '../ui/input';

export class VSCodeInputUI implements IInputUI {
  createInputBox(): InputBox {
    return window.createInputBox();
  }
}
