import { ExtensionContext } from 'vscode';
import { ISettings } from './pick';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class GlobalStateBackedSettings implements ISettings {
  #cachedProfileNames = new Set<string>();

  constructor(private readonly context: ExtensionContext) {
    this.#cachedProfileNames = new Set(this.enumerateProfileNames());
  }

  get profile(): string | undefined {
    return this.context.globalState.get('profile');
  }

  async setProfile(profile: string): Promise<void> {
    await this.context.globalState.update('profile', profile);
    process.env.AWS_PROFILE = profile;
  }

  /** Builds path to the `~/.aws/config` file. */
  get configFilepath(): string {
    const home = os.homedir();
    return path.join(home, '.aws', 'config');
  }

  /** Enumerates names of profiles from config file at `configFilepath`. */
  enumerateProfileNames(): readonly string[] {
    const contents = fs.readFileSync(this.configFilepath, { encoding: 'utf8' });
    const profilePattern = /\[\s*profile\s+([^\]]+)\s*\]/g;
    const matches = [...contents.matchAll(profilePattern)];

    return matches.map(match => match[1]);
  }

  isProfileName(name: string): boolean {
    return this.#cachedProfileNames.has(name);
  }
}
