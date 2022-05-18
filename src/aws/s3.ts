import * as s3 from "@aws-sdk/client-s3";
import { DescribeClustersCommand } from "@aws-sdk/client-ecs";
import { ResourceLoadOptions } from "../pick";
import { Resource } from "../resource";
import { ensureAuthenticated } from "./common/auth";
import { ResourceCache } from "./common/cache";

const ecsCache = new ResourceCache();

export async function getBuckets({
  region,
  loginHooks,
  skipCache,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const s3Client = new s3.S3Client({ region });
  const response = await ensureAuthenticated(
    () => s3Client.send(new s3.ListBucketsCommand({})),
    loginHooks
  );
  const resources = response.Buckets?.map((b) => makeBucketResource(region, b)) ?? [];
  ecsCache.set(region, process.env.AWS_PROFILE, resources);
  return resources;
}

function makeBucketResource(region: string, bucket: s3.Bucket): Resource {
  return {
    name: bucket.Name ?? "Unknown",
    description: "",
    url: `https://s3.console.aws.amazon.com/s3/buckets/${bucket?.Name}?region=${region}&tab=objects`,
  };
}
