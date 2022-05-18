import { commands, ExtensionContext } from "vscode";
import * as cloudformation from "./aws/cloudformation";
import * as cloudfront from "./aws/cloudfront";
import * as ecs from "./aws/ecs";
import * as lambda from "./aws/lambda";
import * as rds from "./aws/rds";
import * as route53 from "./aws/route53";
import * as s3 from "./aws/s3";
import { pick, Pinner } from "./pick";
import process = require("process");

export const PROFILE = "newprod";

class ContextPinner implements Pinner {
  private _pinnedSet: Set<string> | undefined;

  constructor(private readonly context: ExtensionContext) {}

  private get pinnedSet(): Set<string> {
    if (this._pinnedSet) return this._pinnedSet;

    const pinned = this.context.globalState.get<string[]>("pinned", []);
    this._pinnedSet = new Set(pinned);
    return this._pinnedSet;
  }

  isPinned(url: string): boolean {
    return this.pinnedSet.has(url);
  }

  pin(url: string): void {
    const pinned = this.context.globalState.get<string[]>("pinned", []).filter((pu) => pu !== url);
    pinned.push(url);
    this.save(pinned);
  }

  unpin(url: string): void {
    const pinned = this.context.globalState.get<string[]>("pinned", []).filter((pu) => pu !== url);
    this.save(pinned);
  }

  save(pinned: string[]) {
    this.context.globalState.update("pinned", pinned);
    this._pinnedSet = undefined;
  }
}

export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "aws-jri" is now active!');
  context.globalState.update('pinner', null);
  const pinner = new ContextPinner(context);
  context.subscriptions.push(
    commands.registerCommand("jri.route53HostedZones", () => showRoute53HostedZones(pinner)),
    commands.registerCommand("jri.ecsClusters", () => showECSClusters(pinner)),
    commands.registerCommand("jri.s3Buckets", () => showS3Buckets(pinner)),
    commands.registerCommand("jri.lambdaFunctions", () => showLambdaFunctions(pinner)),
    commands.registerCommand("jri.rdsDatabases", () => showRDSDatabases(pinner)),
    commands.registerCommand("jri.cloudformationStacks", () => showCloudFormationStacks(pinner)),
    commands.registerCommand("jri.cloudfrontDistributions", () =>
      showCloudFrontDistributions(pinner)
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("hosted zone", "ap-southeast-2", route53.getHostedZones, pinner);
}

async function showECSClusters(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("cluster", "ap-southeast-2", ecs.getClusters, pinner);
}

async function showS3Buckets(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("bucket", "ap-southeast-2", s3.getBuckets, pinner);
}

async function showLambdaFunctions(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("function", "ap-southeast-2", lambda.getFunctions, pinner);
}

async function showRDSDatabases(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("database", "ap-southeast-2", rds.getDatabases, pinner);
}

async function showCloudFrontDistributions(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("distribution", "ap-southeast-2", cloudfront.getDistributions, pinner);
}

async function showCloudFormationStacks(pinner: Pinner) {
  process.env.AWS_PROFILE = PROFILE;
  await pick("stack", "ap-southeast-2", cloudformation.getStacks, pinner);
}
