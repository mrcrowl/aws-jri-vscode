import { commands, ExtensionContext } from 'vscode';
import * as cloudformation from './aws/cloudformation';
import * as cloudfront from './aws/cloudfront';
import * as ecs from './aws/ecs';
import * as lambda from './aws/lambda';
import * as rds from './aws/rds';
import * as route53 from './aws/route53';
import * as s3 from './aws/s3';
import * as ec2 from './aws/ec2';
import * as dynamodb from './aws/dynamodb';
import * as autoscaling from './aws/autoscaling';
import { pick, IPinner, ISettings } from './pick';
import process = require('process');
import { GlobalStateBackedPinner } from './GlobalStateBackedPinner';
import { GlobalStateBackedSettings } from './GlobalStateBackedSettings';
import { ensureProfile } from './profile';

const PROFILE = 'prod';

export function activate(context: ExtensionContext) {
  context.globalState.update('pinner', null);
  const pinner = new GlobalStateBackedPinner(context);
  const settings: ISettings = new GlobalStateBackedSettings(context);
  context.subscriptions.push(
    commands.registerCommand('jri.route53HostedZones', () => showRoute53HostedZones(pinner, settings)),
    commands.registerCommand('jri.ecsClusters', () => showECSClusters(pinner, settings)),
    commands.registerCommand('jri.s3Buckets', () => showS3Buckets(pinner, settings)),
    commands.registerCommand('jri.lambdaFunctions', () => showLambdaFunctions(pinner, settings)),
    commands.registerCommand('jri.rdsDatabases', () => showRDSDatabases(pinner, settings)),
    commands.registerCommand('jri.cloudformationStacks', () => showCloudFormationStacks(pinner, settings)),
    commands.registerCommand('jri.ec2Instances', () => showEC2Instances(pinner, settings)),
    commands.registerCommand('jri.ec2AutoScalingGroups', () => showAutoscalingGroups(pinner, settings)),
    commands.registerCommand('jri.dynamoDBTables', () => showDynamoDBTables(pinner, settings)),
    commands.registerCommand('jri.cloudfrontDistributions', () => showCloudFrontDistributions(pinner, settings)),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function showRoute53HostedZones(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('hosted zone', 'ap-southeast-2', route53.getHostedZones, pinner, settings);
}

async function showECSClusters(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('cluster', 'ap-southeast-2', ecs.getClusters, pinner, settings);
}

async function showS3Buckets(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('bucket', 'ap-southeast-2', s3.getBuckets, pinner, settings);
}

async function showLambdaFunctions(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('function', 'ap-southeast-2', lambda.getFunctions, pinner, settings);
}

async function showRDSDatabases(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('database', 'ap-southeast-2', rds.getDatabases, pinner, settings);
}

async function showCloudFrontDistributions(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('distribution', 'ap-southeast-2', cloudfront.getDistributions, pinner, settings);
}

async function showCloudFormationStacks(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('stack', 'ap-southeast-2', cloudformation.getStacks, pinner, settings);
}

async function showEC2Instances(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('instance', 'ap-southeast-2', ec2.getHostedZones, pinner, settings);
}

async function showAutoscalingGroups(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('ASG', 'ap-southeast-2', autoscaling.getAutoScalingGroups, pinner, settings);
}

async function showDynamoDBTables(pinner: IPinner, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;
  await pick('table', 'ap-southeast-2', dynamodb.getTables, pinner, settings);
}
