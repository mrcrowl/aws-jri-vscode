import * as rds from '@aws-sdk/client-rds';
import { makeResourceLoader } from './common/loader';

export const getDatabases = makeResourceLoader<rds.RDSClient, rds.DBInstance>({
  init: ({ region }) => new rds.RDSClient({ region }),

  async *enumerate(client) {
    let nextMarker: string | undefined;
    do {
      const response = await client.send(new rds.DescribeDBInstancesCommand({ Marker: nextMarker }));
      yield* response.DBInstances ?? [];
      nextMarker = response.Marker;
    } while (nextMarker);
  },

  map(db, region) {
    return {
      name: db.DBInstanceIdentifier ?? 'Unknown',
      description: `${db.DBInstanceStatus}, ${db.Engine} (${db.EngineVersion})`,
      url: `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${db.DBInstanceIdentifier};is-cluster=false`,
    };
  },
});
