import { IPickUI } from '../pick';
import { IProfileUI } from '../profile';

export interface IUIFactory {
  makeProfileUI(): IProfileUI;
  makePickUI(): IPickUI;
}
