import { window } from 'vscode';
import { IProfileUI } from '../profile';

export class VSCodeProfileUI implements IProfileUI {
  async showNoConfigFoundError(configFilepath: string): Promise<void> {
    await window.showErrorMessage(`No aws config found at:\n${configFilepath}`);
  }

  async showNoProfilesError(configFilepath: string): Promise<void> {
    await window.showErrorMessage(`There are no profiles in:\n${configFilepath}`);
  }

  async pickProfile(profiles: string[]): Promise<string | undefined> {
    return window.showQuickPick(profiles, { placeHolder: 'Pick AWS profile' });
  }
}
