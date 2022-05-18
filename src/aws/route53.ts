import * as route53 from "@aws-sdk/client-route-53";
import { makeResourceLoader } from './common/loader';

export const getHostedZones = makeResourceLoader<route53.Route53Client, route53.HostedZone>({
  init({ region }) {
    return new route53.Route53Client({ region });
  },
  async *enumerate(client) {
    let marker: string | undefined;
    do {
      const response = await client.send(new route53.ListHostedZonesCommand({ Marker: marker }));
      yield* response.HostedZones ?? [];
      marker = response.NextMarker;
    } while (marker);
  },
  map(hz: route53.HostedZone) {
    const hostedZoneID = hz.Id?.replace(/^\/hostedzone\//i, "") ?? "";

    return {
      name: hz.Name ?? hostedZoneID ?? "Unknown",
      description: hz.Name ? hostedZoneID : "",
      url: `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${hostedZoneID}`,
    };
  },
});