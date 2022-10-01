import { IPickUI } from '../pick';
import { IProfileUI } from '../profile';

export interface IUIFactory {
  makeProfileUI(): IProfileUI;
  makePickUI(): IPickUI;
}

export interface IStorage {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
}
