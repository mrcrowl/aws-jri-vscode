import * as cwl from '@aws-sdk/client-cloudwatch-logs';
import { makeResourceLoader } from './common/loader';

export const getLogGroups = makeResourceLoader<cwl.CloudWatchLogsClient, cwl.LogGroup>({
  init: ({ region }) => new cwl.CloudWatchLogsClient({ region }),

  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(new cwl.DescribeLogGroupsCommand({ nextToken }));
      yield* response.logGroups ?? [];
      nextToken = response.nextToken;
    } while (nextToken);
  },

  map(logGroup, region) {
    const escapedLogGroupName = logGroup?.logGroupName?.replace(/\//g, '$252F');
    return {
      name: logGroup.logGroupName ?? 'Unknown',
      description: '',
      url: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${escapedLogGroupName}/log-events`,
    };
  },
});
