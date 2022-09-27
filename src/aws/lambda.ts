import * as lambda from '@aws-sdk/client-lambda';
import { ResourceLoadOptions } from '../pick';
import { Resource } from '../resource';
import { runAWSCommandWithAuthentication } from './common/auth';
import { ResourceCache } from './common/cache';

const ecsCache = new ResourceCache();

export async function getFunctions({
  region,
  loginHooks,
  skipCache,
  settings,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const lambdaClient = new lambda.LambdaClient({ region });
  const resources: Resource[] = [];
  let marker: string | undefined;
  do {
    const response = await runAWSCommandWithAuthentication(
      () => lambdaClient.send(new lambda.ListFunctionsCommand({ Marker: marker })),
      loginHooks,
      settings,
    );
    resources.push(...(response.Functions?.map(fn => makeFunctionResource(region, fn)) ?? []));
    ecsCache.set(region, process.env.AWS_PROFILE, resources);
    marker = response.NextMarker;
  } while (marker);
  return resources;
}

function makeFunctionResource(region: string, fn: lambda.FunctionConfiguration): Resource {
  return {
    name: fn.FunctionName ?? 'Unknown',
    description: fn.Runtime ?? '',
    url: `https://${region}.console.aws.amazon.com/lambda/home?region=${region}#/functions/${fn.FunctionName}?tab=code`,
  };
}
