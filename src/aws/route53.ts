import * as r53 from "@aws-sdk/client-route-53";
import { Resource, ResourceLoadOptions } from "../pick";
import { runAWSCommandMaybeAuth as runAuthenticated } from "./auth";
import { ResourceCache } from "./cache";

const route53Cache = new ResourceCache();

export async function getHostedZones({
  region,
  loginHooks,
  skipCache,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = route53Cache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const route53Client = new r53.Route53Client({ region });
  const response = await runAuthenticated(
    () => route53Client.send(new r53.ListHostedZonesCommand({})),
    loginHooks
  );
  const resources = response.HostedZones?.map(makeHZItem) ?? [];

  route53Cache.set(region, process.env.AWS_PROFILE, resources);
  return resources;
}

function makeHZItem(hz: r53.HostedZone): Resource {
  const hostedZoneID = hz.Id?.replace(/^\/hostedzone\//i, "") ?? "";

  return {
    name: hz.Name ?? hostedZoneID ?? "Unknown",
    description: hz.Name ? hostedZoneID : "",
    url: `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${hostedZoneID}`,
  };
}
