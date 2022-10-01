import { anyString, anything, capture, instance, mock, reset, verify, when } from 'ts-mockito';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ISettings } from './pick';
import { chooseProfile, IProfileUI } from './profile';
import {} from 'vscode';

vi.mock('vscode', () => {
  return {};
});

const PROFILE_NAMES = ['dev', 'test', 'prod'];

describe('chooseProfile', () => {
  const settings = mock<ISettings>();
  const ui = mock<IProfileUI>();

  beforeEach(() => {
    reset(settings);
    reset(ui);

    when(settings.configFilepath).thenReturn('/home/name/.aws/config');
  });

  it('changes profile', async () => {
    // Pick 'test' profile.
    enumeratedProfilesAre(PROFILE_NAMES);
    userPicksProfileNamed('test');

    // Act.
    const result = await chooseProfile(instance(ui), instance(settings));

    // Assert: profiles presented in enumerated order.
    verify(ui.pickProfile(anything())).once();
    const [profiles] = capture(ui.pickProfile).first();
    expect(profiles).toEqual(PROFILE_NAMES);

    // Assert: profile set.
    verify(settings.setProfile(anyString())).once();
    const [profile] = capture(settings.setProfile).first();
    expect(profile).toBe('test');

    // Assert: returned profile matches setProfile.
    expect(result).toBe(profile);
  });

  it('floats the current profile to the top of the list', async () => {
    // Set 'prod' as current profile.
    enumeratedProfilesAre(PROFILE_NAMES);
    currentProfileIs('prod');

    // Act.
    await chooseProfile(instance(ui), instance(settings));

    // Assert: profiles presented with selected profile at the top.
    const [profiles] = capture(ui.pickProfile).first();
    expect(profiles).toEqual(['prod', 'dev', 'test']);
  });

  it('presents error if config file is missing', async () => {
    enumeratedProfilesAre(undefined);

    // Act.
    const profile = await chooseProfile(instance(ui), instance(settings));

    // Assert.
    expect(profile).toBeUndefined();
    verify(ui.pickProfile(anything())).never();
    verify(ui.showNoConfigFoundError(anyString())).once();
  });

  it('presents error if config file contains no profiles', async () => {
    enumeratedProfilesAre([]);

    // Act.
    const profile = await chooseProfile(instance(ui), instance(settings));

    // Assert.
    expect(profile).toBeUndefined();
    verify(ui.pickProfile(anything())).never();
    verify(ui.showNoProfilesError(anyString())).once();
  });

  function enumeratedProfilesAre(profileNames: string[] | undefined) {
    when(settings.enumerateProfileNames()).thenReturn(profileNames);
  }

  function currentProfileIs(profile: string) {
    when(settings.profile).thenReturn(profile);
  }

  function userPicksProfileNamed(profile: string) {
    when(ui.pickProfile(anything())).thenResolve(profile);
  }
});
