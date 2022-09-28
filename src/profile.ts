import { window } from 'vscode';
import { ISettings } from './pick';

/** Prompt for profile if none selected. */
export async function ensureProfile(settings: ISettings): Promise<boolean> {
  const profile = settings.profile ?? (await chooseProfile(settings));
  if (!profile) return false;

  process.env.AWS_PROFILE = profile;
  return true;
}

/** Presents quick pick for choosing a profile. */
export async function chooseProfile(settings: ISettings): Promise<string | undefined> {
  const configFilepath = settings.configFilepath;
  const profiles: string[] | undefined = [...settings.enumerateProfileNames()];
  if (!profiles) {
    window.showErrorMessage(`No aws config found at:\n${configFilepath}`);
    return undefined;
  }

  if (profiles.length === 0) {
    window.showErrorMessage(`There are no profiles in:\n${configFilepath}`);
    return undefined;
  }

  // Move selected to the top.
  if (settings.profile && profiles.includes(settings.profile)) {
    profiles.unshift(...profiles.splice(profiles.indexOf(settings.profile), 1));
  }

  const profile = await window.showQuickPick(profiles, { placeHolder: 'Pick AWS profile' });
  if (!profile) return undefined;

  settings.setProfile(profile);
  process.env.AWS_PROFILE = profile;
  return profile;
}
