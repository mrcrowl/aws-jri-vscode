import { commands, ExtensionContext } from "vscode";
import { pick } from "./pick";
import process = require("process");
import * as route53 from "./aws/route53";
import * as ecs from "./aws/ecs";

export const PROFILE = "newprod";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "aws-jri" is now active!');
  context.subscriptions.push(
    commands.registerCommand("jri.route53HostedZones", () => showRoute53HostedZones()),
    commands.registerCommand("jri.ecsClusters", () => showECSClusters()),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("ap-southeast-2", route53.getHostedZones);
}

async function showECSClusters() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("ap-southeast-2", ecs.getClusters);
}
