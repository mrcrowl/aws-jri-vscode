import * as cf from "@aws-sdk/client-cloudfront";
import { ResourceLoadOptions } from "../pick";
import { Resource } from "../resource";
import { ensureAuthenticated } from "./common/auth";
import { ResourceCache } from "./common/cache";

const cache = new ResourceCache();

export async function getDistributions({
  region,
  loginHooks,
  skipCache,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = cache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const cloudFrontClient = new cf.CloudFrontClient({ region });
  const resources: Resource[] = [];
  let marker: string | undefined;
  do {
    const response = await ensureAuthenticated(
      () => cloudFrontClient.send(new cf.ListDistributionsCommand({ Marker: marker })),
      loginHooks
    );
    resources.push(...(response.DistributionList?.Items?.map((stack) => makeResource(region, stack)) ?? []));
    cache.set(region, process.env.AWS_PROFILE, resources);
    marker = response.DistributionList?.Marker;
  } while (marker);
  return resources;
}

function makeResource(region: string, distribution: cf.DistributionSummary): Resource {
  return {
    name: distribution.Comment ?? "",
    description: `${distribution.DomainName} (${distribution.Id})`,
    url: `https://us-east-1.console.aws.amazon.com/cloudfront/v3/home?region=${region}#/distributions/${distribution.Id}`,
  };
}
