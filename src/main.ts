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
import { GlobalStateBackedMRU, MRUFactoryFn } from './mru';
import { GlobalStateBackedSettings } from './settings';
import { IResourceMRU, ISettings, pick } from './pick';
import { chooseProfile, ensureProfile } from './profile';
import { ResourceType } from './resource';

export function activate(context: ExtensionContext) {
  context.globalState.update('pinner', null);
  const settings: ISettings = new GlobalStateBackedSettings(context);
  const mruFactory = (type: ResourceType): IResourceMRU => new GlobalStateBackedMRU(context, type);

  context.subscriptions.push(
    commands.registerCommand('jri.switchProfile', () => switchProfile(settings)),
    commands.registerCommand('jri.route53HostedZones', () => showRoute53HostedZones(mruFactory, settings)),
    commands.registerCommand('jri.ecsClusters', () => showECSClusters(mruFactory, settings)),
    commands.registerCommand('jri.s3Buckets', () => showS3Buckets(mruFactory, settings)),
    commands.registerCommand('jri.lambdaFunctions', () => showLambdaFunctions(mruFactory, settings)),
    commands.registerCommand('jri.rdsDatabases', () => showRDSDatabases(mruFactory, settings)),
    commands.registerCommand('jri.cloudformationStacks', () => showCloudFormationStacks(mruFactory, settings)),
    commands.registerCommand('jri.ec2Instances', () => showEC2Instances(mruFactory, settings)),
    commands.registerCommand('jri.ec2AutoScalingGroups', () => showAutoscalingGroups(mruFactory, settings)),
    commands.registerCommand('jri.dynamoDBTables', () => showDynamoDBTables(mruFactory, settings)),
    commands.registerCommand('jri.cloudfrontDistributions', () => showCloudFrontDistributions(mruFactory, settings)),
    commands.registerCommand('jri.secrets', () => secrets.showSecrets(mruFactory, settings)),
    commands.registerCommand('jri.ssmParameters', () => ssm.showParameters(mruFactory, settings)),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function switchProfile(settings: ISettings) {
  await chooseProfile(settings);
}

async function showECSClusters(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'cluster',
        region: 'ap-southeast-2',
        loadResources: ecs.getClusters,
        mru: makeMRU('cluster'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showS3Buckets(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'bucket',
        region: 'ap-southeast-2',
        loadResources: s3.getBuckets,
        mru: makeMRU('bucket'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showLambdaFunctions(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'function',
        region: 'ap-southeast-2',
        loadResources: lambda.getFunctions,
        mru: makeMRU('function'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showRDSDatabases(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'database',
        region: 'ap-southeast-2',
        loadResources: rds.getDatabases,
        mru: makeMRU('database'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFrontDistributions(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'distribution',
        region: 'ap-southeast-2',
        loadResources: cloudfront.getDistributions,
        mru: makeMRU('distribution'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showCloudFormationStacks(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'stack',
        region: 'ap-southeast-2',
        loadResources: cloudformation.getStacks,
        mru: makeMRU('stack'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showEC2Instances(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'instance',
        region: 'ap-southeast-2',
        loadResources: ec2.getInstances,
        mru: makeMRU('instance'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showAutoscalingGroups(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'ASG',
        region: 'ap-southeast-2',
        loadResources: autoscaling.getAutoScalingGroups,
        mru: makeMRU('ASG'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

async function showDynamoDBTables(makeMRU: MRUFactoryFn, settings: ISettings) {
  try {
    if (await ensureProfile(settings)) {
      await pick({
        resourceType: 'table',
        region: 'ap-southeast-2',
        loadResources: dynamodb.getTables,
        mru: makeMRU('table'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}
