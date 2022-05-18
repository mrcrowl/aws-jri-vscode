import * as r53 from "@aws-sdk/client-route-53";
import { rejects } from "assert";
import { spawn } from "child_process";
import process = require("process");
import {
  commands,
  Disposable,
  env,
  ExtensionContext,
  ProgressLocation,
  QuickInputButton,
  QuickPickItem,
  QuickPickItemKind,
  Uri,
  window,
} from "vscode";

const PROFILE = "newprod";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "aws-jri" is now active!');
  let disposable = commands.registerCommand("jri.route53HostedZones", () =>
    showRoute53HostedZones()
  );
  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones() {
  process.env.AWS_PROFILE = PROFILE;
  const item = await pick(() => hostedZones());
  if (!item || !item.url) return;
  await env.openExternal(Uri.parse(item.url));
}

async function pick<T extends AWSItem>(
  loadItems: () => Promise<T[]>
): Promise<AWSQuickPickItem | undefined> {
  const picker = window.createQuickPick<AWSQuickPickItem>();
  picker.busy = true;

  return new Promise(async (resolve, reject) => {
    const disposables: Disposable[] = [];

    function onDidAccept() {
      dispose();
      resolve(picker.selectedItems[0]);
    }

    function onDidHide() {
      dispose();
      resolve(undefined);
    }

    function dispose() {
      disposables.forEach((d) => d.dispose());
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.show();
    picker.placeholder = "Loading...";

    const items = await loadItems();
    picker.items = items.map(awsItemToQuickPickItem);
    picker.busy = false;
    picker.placeholder = "Type to filter";
  });
}

function awsItemToQuickPickItem(item: AWSItem): AWSQuickPickItem {
  return {
    label: item.name,
    description: item.description,
    url: item.url,
  };
}

interface AWSQuickPickItem extends QuickPickItem {
  url: string;
}

interface AWSItem {
  name: string;
  description: string;
  url: string;
}

async function hostedZones(): Promise<AWSItem[]> {
  const route53Client = new r53.Route53Client({ region: "ap-southeast-2" });
  const response = await safeRunAwsCommand(() =>
    route53Client.send(new r53.ListHostedZonesCommand({}))
  );
  return response.HostedZones?.map(makeHZItem) ?? [];
}

function makeHZItem(hz: r53.HostedZone): AWSItem {
  const hostedZoneID = hz.Id?.replace(/^\/hostedzone\//i, "") ?? "";

  return {
    name: hz.Name ?? hostedZoneID ?? "Unknown",
    description: hz.Name ? hostedZoneID : "",
    url: `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${hostedZoneID}`,
  };
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
