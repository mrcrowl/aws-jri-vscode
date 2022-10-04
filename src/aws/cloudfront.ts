import * as cf from '@aws-sdk/client-cloudfront';
import { DistributionSummary } from '@aws-sdk/client-cloudfront';
import { makeResourceLoader } from './common/loader';

export const getDistributions = makeResourceLoader<cf.CloudFrontClient, cf.DistributionSummary>({
  init({ region }) {
    return new cf.CloudFrontClient({ region });
  },

  async *enumerate(client) {
    let marker: string | undefined;
    do {
      const response = await client.send(new cf.ListDistributionsCommand({ Marker: marker }));
      yield* response.DistributionList?.Items ?? [];
      marker = response.DistributionList?.Marker;
    } while (marker);
  },

  map(distribution: DistributionSummary, region: string) {
    return {
      name: distribution.Comment ?? '',
      description: `${distribution.DomainName} (${distribution.Id})`,
      url: `https://us-east-1.console.aws.amazon.com/cloudfront/v3/home?region=${region}#/distributions/${distribution.Id}`,
    };
  },
});
