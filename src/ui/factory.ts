import { IProfileUI } from '../profile';

export interface IUIFactory {
  makeProfileUI(): IProfileUI;
}
