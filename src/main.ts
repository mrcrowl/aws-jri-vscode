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
import { MRU, MRUFactoryFn } from './mru';
import { IResourceMRU, ISettings, pick } from './pick';
import { chooseProfile, ensureProfile, IProfileUI } from './profile';
import { ResourceType } from './resource';
import { StoredSettings } from './settings';
import { IKeyValueStorage, IUIFactory } from './ui/interfaces';
import { NodeFileSystem } from './ui/NodeFileSystem';
import { VSCodeContextStorage } from './ui/VSCodeExtensionContext';
import { VSCodePickUI } from './ui/VSCodePickUI';
import { VSCodeProfileUI } from './ui/VSCodeProfileUI';

export function activate(context: ExtensionContext) {
  const storage: IKeyValueStorage = new VSCodeContextStorage(context);
  const settings: ISettings = new StoredSettings(storage, new NodeFileSystem());
  const mruFactory = (type: ResourceType): IResourceMRU => new MRU(storage, type);
  const uiFactory: IUIFactory = {
    makeProfileUI: () => new VSCodeProfileUI(),
    makePickUI: () => new VSCodePickUI(),
  };

  context.subscriptions.push(
    commands.registerCommand('jri.switchProfile', () => switchProfile(uiFactory.makeProfileUI(), settings)),
    commands.registerCommand('jri.route53HostedZones', () => showRoute53HostedZones(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.ecsClusters', () => showECSClusters(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.s3Buckets', () => showS3Buckets(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.lambdaFunctions', () => showLambdaFunctions(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.rdsDatabases', () => showRDSDatabases(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.cloudformationStacks', () =>
      showCloudFormationStacks(mruFactory, uiFactory, settings),
    ),
    commands.registerCommand('jri.ec2Instances', () => showEC2Instances(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.ec2AutoScalingGroups', () => showAutoscalingGroups(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.dynamoDBTables', () => showDynamoDBTables(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.cloudfrontDistributions', () =>
      showCloudFrontDistributions(mruFactory, uiFactory, settings),
    ),
    commands.registerCommand('jri.secrets', () => secrets.showSecrets(mruFactory, uiFactory, settings)),
    commands.registerCommand('jri.ssmParameters', () => ssm.showParameters(mruFactory, uiFactory, settings)),
  );

  context.subscriptions.push(settings);
}

async function switchProfile(profileUI: IProfileUI, settings: ISettings) {
  await chooseProfile(profileUI, settings);
}

async function showECSClusters(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'cluster',
        region: 'ap-southeast-2',
        loadResources: ecs.getClusters,
        mru: makeMRU('cluster'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showS3Buckets(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'bucket',
        region: 'ap-southeast-2',
        loadResources: s3.getBuckets,
        mru: makeMRU('bucket'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showLambdaFunctions(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'function',
        region: 'ap-southeast-2',
        loadResources: lambda.getFunctions,
        mru: makeMRU('function'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showRDSDatabases(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'database',
        region: 'ap-southeast-2',
        loadResources: rds.getDatabases,
        mru: makeMRU('database'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showCloudFrontDistributions(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'distribution',
        region: 'ap-southeast-2',
        loadResources: cloudfront.getDistributions,
        mru: makeMRU('distribution'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showCloudFormationStacks(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'stack',
        region: 'ap-southeast-2',
        loadResources: cloudformation.getStacks,
        mru: makeMRU('stack'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showEC2Instances(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'instance',
        region: 'ap-southeast-2',
        loadResources: ec2.getInstances,
        mru: makeMRU('instance'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showAutoscalingGroups(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'ASG',
        region: 'ap-southeast-2',
        loadResources: autoscaling.getAutoScalingGroups,
        mru: makeMRU('ASG'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

async function showDynamoDBTables(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureProfile(uiFactory.makeProfileUI(), settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'table',
        region: 'ap-southeast-2',
        loadResources: dynamodb.getTables,
        mru: makeMRU('table'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}
