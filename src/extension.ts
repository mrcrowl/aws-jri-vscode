import { commands, ExtensionContext } from "vscode";
import { pick } from "./pick";
import process = require("process");
import * as route53 from "./aws/route53";
import * as ecs from "./aws/ecs";
import * as s3 from "./aws/s3";
import * as lambda from "./aws/lambda";

export const PROFILE = "newprod";

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "aws-jri" is now active!');
  context.subscriptions.push(
    commands.registerCommand("jri.route53HostedZones", () => showRoute53HostedZones()),
    commands.registerCommand("jri.ecsClusters", () => showECSClusters()),
    commands.registerCommand("jri.s3Buckets", () => showS3Buckets()),
    commands.registerCommand("jri.lambdaFunctions", () => showLambdaFunctions())
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("hosted zone", "ap-southeast-2", route53.getHostedZones);
}

async function showECSClusters() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("cluster", "ap-southeast-2", ecs.getClusters);
}

async function showS3Buckets() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("bucket", "ap-southeast-2", s3.getBuckets);
}

async function showLambdaFunctions() {
  process.env.AWS_PROFILE = PROFILE;
  await pick("function", "ap-southeast-2", lambda.getFunctions);
}
