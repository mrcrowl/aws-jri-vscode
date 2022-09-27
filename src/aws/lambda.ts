import * as lambda from '@aws-sdk/client-lambda';
import { makeResourceLoader } from './common/loader';

export const getFunctions = makeResourceLoader<lambda.LambdaClient, lambda.FunctionConfiguration>({
  init: ({ region }) => new lambda.LambdaClient({ region }),

  async *enumerate(client) {
    let nextMarker: string | undefined;
    do {
      const response = await client.send(new lambda.ListFunctionsCommand({ Marker: nextMarker }));
      yield* response.Functions ?? [];
      nextMarker = response.NextMarker;
    } while (nextMarker);
  },

  map(fn, region) {
    return {
      name: fn.FunctionName ?? 'Unknown',
      description: fn.Runtime ?? '',
      url: `https://${region}.console.aws.amazon.com/lambda/home?region=${region}#/functions/${fn.FunctionName}?tab=code`,
    };
  },
});
