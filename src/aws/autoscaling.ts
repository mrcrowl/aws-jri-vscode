import { makeResourceLoader } from "./common/loader";
import * as autoscaling from "@aws-sdk/client-auto-scaling";

export const getAutoScalingGroups = makeResourceLoader<
  autoscaling.AutoScalingClient,
  autoscaling.AutoScalingGroup
>({
  init({ region }) {
    return new autoscaling.AutoScalingClient({ region });
  },
  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new autoscaling.DescribeAutoScalingGroupsCommand({ NextToken: nextToken })
      );
      yield* response.AutoScalingGroups ?? [];
      nextToken = response.NextToken;
    } while (nextToken);
  },
  map(asg: autoscaling.AutoScalingGroup, region) {
    const name = asg?.Tags?.find((t) => t.Key === "Name")?.Value ?? "";

    return {
      name: asg.AutoScalingGroupName ?? "",
      description: `${asg.Instances?.length ?? 0} (min=${asg.MinSize}, desired=${asg.DesiredCapacity}, max=${asg.MaxSize})`,
      url: `https://${region}.console.aws.amazon.com/ec2autoscaling/home?region=${region}#/details/${asg.AutoScalingGroupName}?view=details`,
    };
  },
});
