import { spawn } from "child_process";
import process = require("process");
import { ErrorLike, assertIsErrorLike } from "../../error";
import { PROFILE } from '../../extension';

export interface AuthHooks {
  onAttempt: () => void;
  onSuccess: () => void;
  onFailure: (error: ErrorLike) => void;
}

export async function ensureAuthenticated<T>(command: () => Promise<T>, loginHooks: AuthHooks): Promise<T> {
  try {
    return await command();
  } catch (e) {
    assertIsErrorLike(e);
    if (/The SSO session associated with this profile (has expired|is invalid)/.test(e.message)) {
      return loginSSOAndRetry(loginHooks, command);
    }

    throw e;
  }
}

async function loginSSOAndRetry<T>(
  hooks: AuthHooks,
  successAction: () => Promise<T>
): Promise<T> {
  hooks.onAttempt();
  
  try {
    await loginSSOViaShell();
    hooks.onSuccess();
    
    return successAction();
  } catch (e) {
    assertIsErrorLike(e);
    hooks.onFailure(e);

    throw e;
  }
}

async function loginSSOViaShell(): Promise<void> {
  return new Promise((resolve, reject) => {
    const loginProcess = spawn("aws", ["sso", "login", "--profile", PROFILE], { env: process.env });
    loginProcess.on("exit", (exitCode) => {
      if ((exitCode ?? 1) !== 0) {
        reject(`aws sso login exited with code ${exitCode}`);
      }
      resolve();
    });
  });
}
