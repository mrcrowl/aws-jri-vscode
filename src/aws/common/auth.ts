import { spawn } from 'child_process';
import * as process from 'process';
import { assertIsErrorLike, ErrorLike } from '../../tools/error';
import { ISettings } from '../../ui/interfaces';

export interface IAuthHooks {
  onAttempt: () => void;
  onSuccess: () => void;
  onFailure: (error: ErrorLike) => void;
}

export async function runAWSCommandWithAuthentication<T>(
  command: () => Promise<T>,
  loginHooks: IAuthHooks,
  settings: ISettings,
): Promise<T> {
  try {
    return await command();
  } catch (e) {
    assertIsErrorLike(e);
    if (/The SSO session associated with this profile (has expired|is invalid)/.test(e.message)) {
      return loginSSOAndRetry(loginHooks, settings, command);
    }
    if (/Session token not found or invalid/.test(e.message)) {
      return loginSSOAndRetry(loginHooks, settings, command);
    }

    throw e;
  }
}

async function loginSSOAndRetry<T>(
  hooks: IAuthHooks,
  settings: ISettings,
  successAction: () => Promise<T>,
): Promise<T> {
  hooks.onAttempt();

  try {
    await loginSSOViaShell(settings);
    hooks.onSuccess();

    return successAction();
  } catch (e) {
    assertIsErrorLike(e);
    hooks.onFailure(e);

    throw e;
  }
}

async function loginSSOViaShell(settings: ISettings): Promise<void> {
  return new Promise((resolve, reject) => {
    const loginProcess = spawn('aws', ['sso', 'login', '--profile', settings.profile ?? ''], { env: process.env });
    loginProcess.on('exit', exitCode => {
      if ((exitCode ?? 1) !== 0) {
        reject(`aws sso login exited with code ${exitCode}`);
      }
      resolve();
    });
  });
}
