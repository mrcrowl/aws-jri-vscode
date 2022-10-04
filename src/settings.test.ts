import 'os';
import { anyString, instance, mock, reset, when } from 'ts-mockito';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uri } from 'vscode';
import { ISettings } from './pick';
import { PROFILE_KEY, StoredSettings } from './settings';
import { IFileSystem, IKeyValueStorage } from './vscode/interfaces';
import { FakeStorage, FakeFileSystemWatcher } from './__test__/fakes';

vi.mock('os', () => {
  return { homedir: () => '/home/me' };
});

const FAKE_URI: Uri = {} as Uri;

describe('StoredSettings', () => {
  const mockFileSystem = mock<IFileSystem>();

  let watcherMock: FakeFileSystemWatcher;
  let settingsMock: ISettings;
  let storageMock: IKeyValueStorage;

  beforeEach(async () => {
    watcherMock = new FakeFileSystemWatcher();

    // Storage.
    storageMock = new FakeStorage();
    await storageMock.update(PROFILE_KEY, 'dev');

    // FileSystem.
    reset(mockFileSystem);
    when(mockFileSystem.watchFile(anyString())).thenReturn(watcherMock);

    // Settings.
    settingsMock = new StoredSettings(storageMock, instance(mockFileSystem));
  });

  describe('enumerateProfileNames', () => {
    it('parses profiles from valid file', () => {
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(EXAMPLE_CONFIG_FILE_CONTENTS);

      const profileNames = settingsMock.enumerateProfileNames();

      expect(profileNames).toEqual(['dev', 'prod', 'test']);
    });

    it('empty array if file contains no profiles', () => {
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn('HELLO\nWORLD\n');

      const profileNames = settingsMock.enumerateProfileNames();

      expect(profileNames).toEqual([]);
    });

    it('returns undefined when file is missing', () => {
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(undefined);

      const profileNames = settingsMock.enumerateProfileNames();

      expect(profileNames).toBeUndefined();
    });
  });

  describe('isProfileName', () => {
    it('returns true/false depending on whether the profile name exists in the config file', () => {
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(EXAMPLE_CONFIG_FILE_CONTENTS);
      const settings = new StoredSettings(storageMock, instance(mockFileSystem));
      expect(settings.isProfileName('prod')).toBe(true);
      expect(settings.isProfileName('dev')).toBe(true);
      expect(settings.isProfileName('test')).toBe(true);
      expect(settings.isProfileName('qa')).toBe(false);
    });
  });

  describe('configFilepath', () => {
    it('returns the config filepath', () => {
      expect(settingsMock.configFilepath).toBe('/home/me/.aws/config');
    });
  });

  describe('change detection', () => {
    it('updates when the config file changes', () => {
      // Start with config that has: dev, prod, test.
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(EXAMPLE_CONFIG_FILE_CONTENTS);
      const settings = new StoredSettings(storageMock, instance(mockFileSystem));
      expect(settings.isProfileName('prod')).toBe(true);
      expect(settings.isProfileName('dev')).toBe(true);
      expect(settings.isProfileName('test')).toBe(true);
      expect(settings.isProfileName('qa')).toBe(false);
      expect(settings.enumerateProfileNames()).toEqual(['dev', 'prod', 'test']);

      // Change config to only include: dev, qa.
      reset(mockFileSystem);
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(EXAMPLE_MODIFIED_CONFIG_FILE_CONTENTS);
      watcherMock.fireOnDidChange(FAKE_URI);
      expect(settings.isProfileName('prod')).toBe(false);
      expect(settings.isProfileName('test')).toBe(false);
      expect(settings.isProfileName('dev')).toBe(true);
      expect(settings.isProfileName('qa')).toBe(true);
      expect(settings.enumerateProfileNames()).toEqual(['dev', 'qa']);
    });

    it('updates when the config file is created', () => {
      // Start with no config file
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(undefined);
      const settings = new StoredSettings(storageMock, instance(mockFileSystem));
      expect(settings.isProfileName('prod')).toBe(false);
      expect(settings.isProfileName('dev')).toBe(false);
      expect(settings.isProfileName('test')).toBe(false);
      expect(settings.enumerateProfileNames()).toEqual(undefined);

      // Create config which includes: dev, prod, test.
      reset(mockFileSystem);
      when(mockFileSystem.readTextFile(settingsMock.configFilepath)).thenReturn(EXAMPLE_CONFIG_FILE_CONTENTS);
      watcherMock.fireOnDidCreate(FAKE_URI);
      expect(settings.isProfileName('prod')).toBe(true);
      expect(settings.isProfileName('dev')).toBe(true);
      expect(settings.isProfileName('test')).toBe(true);
      expect(settings.enumerateProfileNames()).toEqual(['dev', 'prod', 'test']);
    });
  });
});

export const EXAMPLE_CONFIG_FILE_CONTENTS = `[default]
region=ap-southeast-2

;; RANDOM COMMENT

[profile dev] ;; RANDOM COMMENT
sso_start_url=https://sso.awsapps.com/start/
sso_region=ap-southeast-2
sso_account_id=123456789101
sso_role_name=AWSAdministratorAccess
region=ap-southeast-2
role_session_name=dev

[profile prod]
sso_start_url=https://sso.awsapps.com/start/
sso_region=ap-southeast-2
sso_account_id=223456789101
sso_role_name=AWSAdministratorAccess
region=ap-southeast-2;; RANDOM COMMENT
role_session_name=prod

[profile test];; RANDOM COMMENT
sso_start_url=https://sso.awsapps.com/start/
sso_region=ap-southeast-2
sso_account_id=423456789101
sso_role_name=AWSAdministratorAccess
region=ap-southeast-2
role_session_name=build

;; [profile commentonly]
`;

const EXAMPLE_MODIFIED_CONFIG_FILE_CONTENTS = '\n\n[profile dev]\n\n[profile qa]\n\n\n';
