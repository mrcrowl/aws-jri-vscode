import * as cf from "@aws-sdk/client-cloudformation";
import { ResourceLoadOptions } from "../pick";
import { Resource } from "../resource";
import { runAWSCommandMaybeAuth as runAuthenticated } from "./common/auth";
import { ResourceCache } from "./common/cache";

const cache = new ResourceCache();

export async function getStacks({
  region,
  loginHooks,
  skipCache,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = cache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const cloudformationClient = new cf.CloudFormationClient({ region });
  const resources: Resource[] = [];
  let marker: string | undefined;
  do {
    const response = await runAuthenticated(
      () => cloudformationClient.send(new cf.ListStacksCommand({ NextToken: marker })),
      loginHooks
    );
    resources.push(...(response.StackSummaries?.map((stack) => makeResource(region, stack)) ?? []));
    cache.set(region, process.env.AWS_PROFILE, resources);
    marker = response.NextToken;
  } while (marker);
  return resources;
}

function makeResource(region: string, stack: cf.StackSummary): Resource {
  return {
    name: stack.StackName ?? "Unknown",
    description: `$(sync~spin) ${stack.StackStatus}`,
    url: `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/stackinfo?filteringStatus=active&filteringText=${stack.StackName}&viewNested=true&hideStacks=false&stackId=${stack.StackId}`,
  };
}
