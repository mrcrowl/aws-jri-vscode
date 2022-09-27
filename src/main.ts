import { commands, ExtensionContext, window } from 'vscode';
import * as autoscaling from './aws/autoscaling';
import * as cloudformation from './aws/cloudformation';
import * as cloudfront from './aws/cloudfront';
import * as dynamodb from './aws/dynamodb';
import * as ec2 from './aws/ec2';
import * as ecs from './aws/ecs';
import * as lambda from './aws/lambda';
import * as rds from './aws/rds';
import { showRoute53HostedZones } from './aws/route53';
import * as s3 from './aws/s3';
import * as secrets from './aws/secrets';
import * as ssm from './aws/ssm';
import { assertIsErrorLike } from './error';
import { GlobalStateBackedMRU } from './GlobalStateBackedMRU';
import { GlobalStateBackedSettings } from './GlobalStateBackedSettings';
import { IResourceMRU, ISettings, pick } from './pick';
import { chooseProfile, ensureProfile } from './profile';

export function activate(context: ExtensionContext) {
  context.globalState.update('pinner', null);
  const settings: ISettings = new GlobalStateBackedSettings(context);
  const mru: IResourceMRU = new GlobalStateBackedMRU(context);

  context.subscriptions.push(
    commands.registerCommand('jri.switchProfile', () => switchProfile(settings)),
    commands.registerCommand('jri.route53HostedZones', () => showRoute53HostedZones(mru, settings)),
    commands.registerCommand('jri.ecsClusters', () => showECSClusters(mru, settings)),
    commands.registerCommand('jri.s3Buckets', () => showS3Buckets(mru, settings)),
    commands.registerCommand('jri.lambdaFunctions', () => showLambdaFunctions(mru, settings)),
    commands.registerCommand('jri.rdsDatabases', () => showRDSDatabases(mru, settings)),
    commands.registerCommand('jri.cloudformationStacks', () => showCloudFormationStacks(mru, settings)),
    commands.registerCommand('jri.ec2Instances', () => showEC2Instances(mru, settings)),
    commands.registerCommand('jri.ec2AutoScalingGroups', () => showAutoscalingGroups(mru, settings)),
    commands.registerCommand('jri.dynamoDBTables', () => showDynamoDBTables(mru, settings)),
    commands.registerCommand('jri.cloudfrontDistributions', () => showCloudFrontDistributions(mru, settings)),
    commands.registerCommand('jri.secrets', () => secrets.showSecrets(mru, settings)),
    commands.registerCommand('jri.ssmParameters', () => ssm.showParameters(mru, settings)),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function switchProfile(settings: ISettings) {
  await chooseProfile(settings);
}

async function showECSClusters(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'cluster',
        region: 'ap-southeast-2',
        loadResources: ecs.getClusters,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showS3Buckets(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({ resourceType: 'bucket', region: 'ap-southeast-2', loadResources: s3.getBuckets, mru, settings });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showLambdaFunctions(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'function',
        region: 'ap-southeast-2',
        loadResources: lambda.getFunctions,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showRDSDatabases(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'database',
        region: 'ap-southeast-2',
        loadResources: rds.getDatabases,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFrontDistributions(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'distribution',
        region: 'ap-southeast-2',
        loadResources: cloudfront.getDistributions,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFormationStacks(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'stack',
        region: 'ap-southeast-2',
        loadResources: cloudformation.getStacks,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showEC2Instances(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'instance',
        region: 'ap-southeast-2',
        loadResources: ec2.getHostedZones,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showAutoscalingGroups(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'ASG',
        region: 'ap-southeast-2',
        loadResources: autoscaling.getAutoScalingGroups,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showDynamoDBTables(mru: IResourceMRU, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'table',
        region: 'ap-southeast-2',
        loadResources: dynamodb.getTables,
        mru,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}
