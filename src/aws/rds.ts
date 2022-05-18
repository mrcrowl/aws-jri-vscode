import * as rds from "@aws-sdk/client-rds";
import { ResourceLoadOptions } from "../pick";
import { Resource } from "../resource";
import { runAWSCommandMaybeAuth as runAuthenticated } from "./common/auth";
import { ResourceCache } from "./common/cache";

const ecsCache = new ResourceCache();

export async function getDatabases({
  region,
  loginHooks,
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
    const response = await runAuthenticated(
      () => rdsClient.send(new rds.DescribeDBInstancesCommand({ Marker: marker })),
      loginHooks
    );
    resources.push(...(response.DBInstances?.map((db) => makeInstanceResource(region, db)) ?? []));
    ecsCache.set(region, process.env.AWS_PROFILE, resources);
    marker = response.Marker;
  } while (marker);
  return resources;
}

function makeInstanceResource(region: string, db: rds.DBInstance): Resource {
  return {
    name: db.DBInstanceIdentifier ?? "Unknown",
    description: `${db.DBInstanceStatus}, ${db.Engine} (${db.EngineVersion})`,
    url: `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${db.DBInstanceIdentifier};is-cluster=false`,
  };
}
