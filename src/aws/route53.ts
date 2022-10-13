import * as route53 from '@aws-sdk/client-route-53';
import { window } from 'vscode';
import { MRUFactoryFn } from '../model/mru';
import { assertIsErrorLike } from '../tools/error';
import { ISettings, IUIFactory } from '../ui/interfaces';
import { ensureMandatorySettings } from '../ui/mandatory';
import { pick } from '../ui/pick';
import { makeResourceLoader } from './common/loader';

export async function showRoute53HostedZones(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  try {
    if (await ensureMandatorySettings(makeMRU, uiFactory, settings)) {
      await pick({
        ui: uiFactory.makePickUI(),
        resourceType: 'hosted zone',
        loadResources: getHostedZones,
        mru: makeMRU('hosted zone'),
        settings,
      });
    }
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

const getHostedZones = makeResourceLoader<route53.Route53Client, route53.HostedZone>({
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
    const hostedZoneID = hz.Id?.replace(/^\/hostedzone\//i, '') ?? '';

    return {
      name: hz.Name ?? hostedZoneID ?? 'Unknown',
      description: hz.Name ? hostedZoneID : '',
      url: `https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones#ListRecordSets/${hostedZoneID}`,
    };
  },
});
