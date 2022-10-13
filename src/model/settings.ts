import * as os from 'os';
import * as path from 'path';
import { Disposable, FileSystemWatcher } from 'vscode';
import { IFileSystem, IKeyValueStorage, ISettings } from '../ui/interfaces';

export const PROFILE_KEY = 'profile';
export const REGION_KEY = 'region';

export class StoredSettings implements ISettings {
  #cachedProfileNames: Set<string> | undefined;
  #configFileWatcher: FileSystemWatcher;
  #diposables: Disposable[];

  constructor(private readonly storage: IKeyValueStorage, private readonly fileSystem: IFileSystem) {
    this.#diposables = [];
    this.#configFileWatcher = fileSystem.watchFile(this.configFilepath);
    this.#configFileWatcher.onDidChange(this.onConfigFileChange, this, this.#diposables);
    this.#configFileWatcher.onDidCreate(this.onConfigFileChange, this, this.#diposables);
  }

  dispose() {
    this.#diposables.forEach(d => d.dispose());
  }

  get profile(): string | undefined {
    return this.storage.get(PROFILE_KEY);
  }

  async setProfile(profile: string): Promise<void> {
    await this.storage.update(PROFILE_KEY, profile);
    process.env.AWS_PROFILE = profile;
  }

  get region(): string | undefined {
    return this.storage.get(REGION_KEY);
  }

  async setRegion(region: string): Promise<void> {
    await this.storage.update(REGION_KEY, region);
  }

  /** Builds path to the `~/.aws/config` file. */
  get configFilepath(): string {
    const home = os.homedir();
    return path.join(home, '.aws', 'config');
  }

  /** Handler for when the config file changes. */
  onConfigFileChange() {
    this.#cachedProfileNames = undefined;
  }

  /** Returns true if name is a known profile name. */
  isProfileName(name: string): boolean {
    if (!this.#cachedProfileNames) {
      this.#cachedProfileNames = new Set(this.enumerateProfileNames());
    }

    return this.#cachedProfileNames.has(name);
  }

  /** Enumerates names of profiles from AWS config file. */
  enumerateProfileNames(): string[] | undefined {
    const contents = this.fileSystem.readTextFile(this.configFilepath);
    if (!contents) return undefined;
    const profilePattern = /^\s*\[\s*profile\s+([^\]]+)\s*\]/gm;
    const matches = [...contents.matchAll(profilePattern)];

    return matches.map(match => match[1]);
  }
}
