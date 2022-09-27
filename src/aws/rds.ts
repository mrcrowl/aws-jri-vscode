import * as rds from '@aws-sdk/client-rds';
import { ResourceLoadOptions } from '../pick';
import { Resource } from '../resource';
import { runAWSCommandWithAuthentication } from './common/auth';
import { ResourceCache } from './common/cache';

const ecsCache = new ResourceCache();

export async function getDatabases({
  region,
  loginHooks,
  settings,
  skipCache,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const rdsClient = new rds.RDSClient({ region });
  const resources: Resource[] = [];
  let marker: string | undefined;
  do {
    const response = await runAWSCommandWithAuthentication(
      () => rdsClient.send(new rds.DescribeDBInstancesCommand({ Marker: marker })),
      loginHooks,
      settings,
    );
    resources.push(...(response.DBInstances?.map(db => makeInstanceResource(region, db)) ?? []));
    ecsCache.set(region, process.env.AWS_PROFILE, resources);
    marker = response.Marker;
  } while (marker);
  return resources;
}

function makeInstanceResource(region: string, db: rds.DBInstance): Resource {
  return {
    name: db.DBInstanceIdentifier ?? 'Unknown',
    description: `${db.DBInstanceStatus}, ${db.Engine} (${db.EngineVersion})`,
    url: `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${db.DBInstanceIdentifier};is-cluster=false`,
  };
}
