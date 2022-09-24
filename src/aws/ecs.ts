import * as ecs from '@aws-sdk/client-ecs';
import { DescribeClustersCommand } from '@aws-sdk/client-ecs';
import { ResourceLoadOptions } from '../pick';
import { Resource } from '../resource';
import { ensureAuthenticated } from './common/auth';
import { ResourceCache } from './common/cache';

const ecsCache = new ResourceCache();

export async function getClusters({
  region,
  loginHooks,
  skipCache,
  settings,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const ecsClient = new ecs.ECSClient({ region });
  const response = await ensureAuthenticated(
    () => ecsClient.send(new ecs.ListClustersCommand({})),
    loginHooks,
    settings,
  );
  const clusterArns = response.clusterArns;
  const clustersOutput = await ecsClient.send(new DescribeClustersCommand({ clusters: clusterArns }));
  const resources = clustersOutput.clusters?.map(c => makeClusterItem(region, c)) ?? [];
  ecsCache.set(region, process.env.AWS_PROFILE, resources);
  return resources;
}

function makeClusterItem(region: string, cluster: ecs.Cluster): Resource {
  return {
    name: cluster.clusterName ?? 'Unknown',
    description: `${cluster.runningTasksCount} running tasks`,
    url: `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${cluster.clusterName}/services?region=${region}#`,
  };
}
