import * as ec2 from '@aws-sdk/client-ec2';
import { makeResourceLoader } from './common/loader';

export const getInstances = makeResourceLoader<ec2.EC2Client, ec2.Instance>({
  init: ({ region }) => new ec2.EC2Client({ region }),

  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(new ec2.DescribeInstancesCommand({ NextToken: nextToken }));
      yield* response.Reservations?.flatMap(r => r.Instances ?? []) ?? [];
      nextToken = response.NextToken;
    } while (nextToken);
  },

  map(instance: ec2.Instance, region) {
    const name = instance?.Tags?.find(t => t.Key === 'Name')?.Value ?? '';

    return {
      name: name,
      description: `${instance.InstanceId}, ${instance.State?.Name}, ${instance.InstanceType}`,
      url: `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#InstanceDetails:instanceId=${instance.InstanceId}`,
    };
  },
});
