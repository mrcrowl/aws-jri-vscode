import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
  const configFilepath = makeConfigFilePath();
  const profiles: string[] | undefined = [...enumerateProfiles(configFilepath)];
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

/** Enumerates names of profiles from config file at `configFilepath`. */
function* enumerateProfiles(configFilepath: string) {
  const contents = fs.readFileSync(configFilepath, { encoding: 'utf8' });
  const profilePattern = /\[\s*profile\s+([^\]]+)\s*\]/g;
  const matches = [...contents.matchAll(profilePattern)];
  for (const match of matches) {
    yield match[1];
  }
}

/** Builds path to the `~/.aws/config` file. */
function makeConfigFilePath() {
  const home = os.homedir();
  return path.join(home, '.aws', 'config');
}
