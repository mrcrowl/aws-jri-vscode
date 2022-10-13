import { ISettings } from './interfaces';

type Region = { id: string; name: string };

const REGIONS: Region[] = [
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-west-1', name: 'US West (N. California)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'af-south-1', name: 'Africa (Cape Town)' },
  { id: 'ap-east-1', name: 'Asia Pacific (Hong Kong)' },
  { id: 'ap-southeast-3', name: 'Asia Pacific (Jakarta)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { id: 'ap-northeast-3', name: 'Asia Pacific (Osaka)' },
  { id: 'ap-northeast-2', name: 'Asia Pacific (Seoul)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'ca-central-1', name: 'Canada (Central)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-west-2', name: 'Europe (London)' },
  { id: 'eu-south-1', name: 'Europe (Milan)' },
  { id: 'eu-west-3', name: 'Europe (Paris)' },
  { id: 'eu-north-1', name: 'Europe (Stockholm)' },
  { id: 'me-south-1', name: 'Middle East (Bahrain)' },
  { id: 'me-central-1', name: 'Middle East (UAE)' },
  { id: 'sa-east-1', name: 'South America (São Paulo)' },
];

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
