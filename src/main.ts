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
import { GlobalStateBackedPinner } from './GlobalStateBackedPinner';
import { GlobalStateBackedSettings } from './GlobalStateBackedSettings';
import { IPinner, ISettings, pick } from './pick';
import { chooseProfile, ensureProfile } from './profile';

export function activate(context: ExtensionContext) {
  context.globalState.update('pinner', null);
  const pinner = new GlobalStateBackedPinner(context);
  const settings: ISettings = new GlobalStateBackedSettings(context);
  context.subscriptions.push(
    commands.registerCommand('jri.switchProfile', () => switchProfile(settings)),
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
    commands.registerCommand('jri.secrets', () => secrets.showSecrets(pinner, settings)),
    commands.registerCommand('jri.ssmParameters', () => ssm.showParameters(pinner, settings)),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function switchProfile(settings: ISettings) {
  await chooseProfile(settings);
}

async function showECSClusters(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'cluster',
        region: 'ap-southeast-2',
        loadResources: ecs.getClusters,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showS3Buckets(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({ resourceType: 'bucket', region: 'ap-southeast-2', loadResources: s3.getBuckets, pinner, settings });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showLambdaFunctions(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'function',
        region: 'ap-southeast-2',
        loadResources: lambda.getFunctions,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showRDSDatabases(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'database',
        region: 'ap-southeast-2',
        loadResources: rds.getDatabases,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFrontDistributions(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'distribution',
        region: 'ap-southeast-2',
        loadResources: cloudfront.getDistributions,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFormationStacks(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'stack',
        region: 'ap-southeast-2',
        loadResources: cloudformation.getStacks,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showEC2Instances(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'instance',
        region: 'ap-southeast-2',
        loadResources: ec2.getHostedZones,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showAutoscalingGroups(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'ASG',
        region: 'ap-southeast-2',
        loadResources: autoscaling.getAutoScalingGroups,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showDynamoDBTables(pinner: IPinner, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'table',
        region: 'ap-southeast-2',
        loadResources: dynamodb.getTables,
        pinner,
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}
