import { MRUFactoryFn } from '../model/mru';
import { Resource } from '../model/resource';
import { ISettings, IUIFactory } from './interfaces';
import { pick } from './pick';

type Region = { id: string; name: string };

export const DEFAULT_REGION = 'us-east-1';

const REGIONS: Region[] = [
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-west-1', name: 'US West (N. California)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'af-south-1', name: 'Africa (Cape Town)' },
  { id: 'ap-east-1', name: 'Asia Pacific (Hong Kong)' },
  { id: 'ap-southeast-3', name: 'Asia Pacific (Jakarta)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { id: 'ap-northeast-3', name: 'Asia Pacific (Osaka)' },
  { id: 'ap-northeast-2', name: 'Asia Pacific (Seoul)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'ca-central-1', name: 'Canada (Central)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-west-2', name: 'Europe (London)' },
  { id: 'eu-south-1', name: 'Europe (Milan)' },
  { id: 'eu-west-3', name: 'Europe (Paris)' },
  { id: 'eu-north-1', name: 'Europe (Stockholm)' },
  { id: 'me-south-1', name: 'Middle East (Bahrain)' },
  { id: 'me-central-1', name: 'Middle East (UAE)' },
  { id: 'sa-east-1', name: 'South America (São Paulo)' },
];

const REGION_RESOURCES: Resource[] = REGIONS.map(r => {
  return {
    name: r.id,
    description: r.name,
    url: `region://${r.name}`, // Must be set for picker.
  };
});

/** Prompt for profile if none selected. */
export async function ensureRegion(
  makeMRU: MRUFactoryFn,
  uiFactory: IUIFactory,
  settings: ISettings,
): Promise<boolean> {
  const region = settings.region ?? (await chooseRegion(makeMRU, uiFactory, settings));
  if (!region) return false;

  await settings.setRegion(region);
  return true;
}

/** Presents quick pick for choosing a profile. */
export async function chooseRegion(
  makeMRU: MRUFactoryFn,
  uiFactory: IUIFactory,
  settings: ISettings,
): Promise<string | undefined> {
  const ui = uiFactory.makePickUI();

  const regionQuickPickItem = await pick({
    ui,
    settings,
    mru: makeMRU('resource'),
    loadResources: async () => REGION_RESOURCES,
    resourceType: 'region',
    onSelected: async () => {
      return { finished: true };
    },
  });

  return regionQuickPickItem?.resource?.name;
}
