import { anyString, instance, mock, reset, when } from 'ts-mockito';
import { MRU } from '../model/mru';
import { ResourceType } from '../model/resource';
import { ISettings, IUIFactory } from '../ui/interfaces';
import { FakeStorage } from './fakes';

const KNOWN_PROFILES = ['dev', 'test', 'prod'];

export type CommonDependencies = ReturnType<typeof setupCommonDependencies>;

export function setupCommonDependencies(resourceType: ResourceType) {
  const mockUIFactory = mock<IUIFactory>();
  const mockSettings = mock<ISettings>();

  let profile: string | undefined = undefined;
  let fakeStorage: FakeStorage;
  let mru: MRU;

  const deps = {
    mockUIFactory,
    mockSettings,
    makeMruFn() {
      return mru;
    },
    get fakeStorage(): FakeStorage {
      return fakeStorage;
    },
    get mru(): MRU {
      return mru;
    },
    get settings(): ISettings {
      return instance(mockSettings);
    },
    get uiFactory(): IUIFactory {
      return instance(mockUIFactory);
    },
    reset() {
      profile = 'dev';
      fakeStorage = new FakeStorage();
      mru = new MRU(fakeStorage, resourceType);
      reset(mockUIFactory);
      reset(mockSettings);
      when(mockSettings.profile).thenCall(() => profile);
      when(mockSettings.setProfile(anyString())).thenCall(nextProfile => (profile = nextProfile));
      when(mockSettings.isProfileName(anyString())).thenCall(profile => KNOWN_PROFILES.includes(profile));
    },
  } as const;
  deps.reset();
  return deps;
}
