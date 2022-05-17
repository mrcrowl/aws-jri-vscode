import * as r53 from "@aws-sdk/client-route-53";
import { spawn } from "child_process";
import process = require("process");
import * as vscode from "vscode";

const PROFILE = "newprod";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "aws-jri" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("jri.route53HostedZones", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    return showRoute53HostedZones();
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones() {
  process.env.AWS_PROFILE = PROFILE;
  const route53Client = new r53.Route53Client({ region: "ap-southeast-2" });
  const response = await safeRunAwsCommand(() =>
    route53Client.send(new r53.ListHostedZonesCommand({}))
  );
  const names = response.HostedZones?.map((hz) => makeHostedZoneQuickpick(hz)) ?? [];
  const selectedHZItem = await vscode.window.showQuickPick(names, { canPickMany: false });
  if (!selectedHZItem || !selectedHZItem.hostedZoneID) return;

  const url = `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${selectedHZItem.hostedZoneID}`;
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function safeRunAwsCommand<T>(command: () => Promise<T>): Promise<T> {
  try {
    return await command();
  } catch (e) {
    assertIsError(e);
    if (/The SSO session associated with this profile (has expired|is invalid)/.test(e.message)) {
      return loginAndThenRetry(() => command());
    }

    throw e;
  }
}

async function loginAndThenRetry<T>(successAction: () => Promise<T>): Promise<T> {
  await loginSSO();
  return successAction();
}

async function loginSSO(): Promise<void> {
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

function assertIsError(e: unknown): asserts e is { message: string } {
  if (typeof e === "object" && e !== null && "message" in e) {
    return;
  }

  throw new Error(JSON.stringify(e));
}

interface HostedZoneQuickpickItem extends vscode.QuickPickItem {
  hostedZoneID: string;
}

function makeHostedZoneQuickpick(hz: r53.HostedZone): HostedZoneQuickpickItem {
  const hostedZoneID = hz.Id?.replace(/^\/hostedzone\//i, "") ?? "";

  return {
    label: hz.Name ?? hz.Id ?? "Unknown",
    description: hostedZoneID,
    hostedZoneID,
  };
}
