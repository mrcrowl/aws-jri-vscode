import * as ecs from '@aws-sdk/client-ecs';
import { makeResourceLoader } from './common/loader';

export const getClusters = makeResourceLoader<ecs.ECSClient, ecs.Cluster>({
  init: ({ region }) => new ecs.ECSClient({ region }),

  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(new ecs.ListClustersCommand({ nextToken: nextToken }));
      const descriptions = await client.send(new ecs.DescribeClustersCommand({ clusters: response.clusterArns ?? [] }));
      yield* descriptions.clusters ?? [];
      nextToken = response.nextToken;
    } while (nextToken);
  },

  map(cluster: ecs.Cluster, region) {
    return {
      name: cluster.clusterName ?? 'Unknown',
      description: `${cluster.runningTasksCount} running tasks`,
      url: `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${cluster.clusterName}/services?region=${region}#`,
    };
  },
});
