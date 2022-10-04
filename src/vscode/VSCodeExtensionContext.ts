import { ExtensionContext } from 'vscode';
import { IKeyValueStorage } from '../ui/interfaces';

export class VSCodeContextStorage implements IKeyValueStorage {
  constructor(private readonly context: ExtensionContext) {}

  get<T>(key: string, defaultValue: T): T {
    return this.context.globalState.get(key, defaultValue);
  }

  async update(key: string, value: any): Promise<void> {
    await this.context.globalState.update(key, value);
  }
}
