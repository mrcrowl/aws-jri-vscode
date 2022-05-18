import { commands, ExtensionContext } from "vscode";
import { pick } from "./pick";
import process = require("process");
import { getHostedZones } from "./aws/route53";

export const PROFILE = "newprod";

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
  await pick("ap-southeast-2", getHostedZones);
}
