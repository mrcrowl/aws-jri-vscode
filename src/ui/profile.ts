import { ISettings } from './interfaces';

export interface IProfileUI {
  showNoConfigFoundError(configFilepath: string): Promise<void>;
  showNoProfilesError(configFilepath: string): Promise<void>;
  pickProfile(profiles: string[]): Promise<string | undefined>;
}

/** Prompt for profile if none selected. */
export async function ensureProfile(ui: IProfileUI, settings: ISettings): Promise<boolean> {
  const profile = settings.profile ?? (await chooseProfile(ui, settings));
  if (!profile) return false;

  process.env.AWS_PROFILE = profile;
  return true;
}

/** Presents quick pick for choosing a profile. */
export async function chooseProfile(ui: IProfileUI, settings: ISettings): Promise<string | undefined> {
  const configFilepath = settings.configFilepath;
  const profiles: string[] | undefined = settings.enumerateProfileNames();
  if (!profiles) {
    await ui.showNoConfigFoundError(configFilepath);
    return undefined;
  }

  if (profiles.length === 0) {
    await ui.showNoProfilesError(configFilepath);
    return undefined;
  }

  // Move selected to the top.
  if (settings.profile && profiles.includes(settings.profile)) {
    profiles.unshift(...profiles.splice(profiles.indexOf(settings.profile), 1));
  }

  const profile: string | undefined = await ui.pickProfile(profiles);
  if (profile) await settings.setProfile(profile);
  return profile;
}
