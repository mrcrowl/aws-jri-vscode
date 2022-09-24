import { ExtensionContext } from 'vscode';
import { ISettings } from './pick';

export class GlobalStateBackedSettings implements ISettings {
  constructor(private readonly context: ExtensionContext) {}

  get profile(): string | undefined {
    return this.context.globalState.get('profile');
  }

  async setProfile(profile: string): Promise<void> {
    await this.context.globalState.update('profile', profile);
  }
}
