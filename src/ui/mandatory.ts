import { MRUFactoryFn } from '../model/mru';
import { ISettings, IUIFactory } from './interfaces';
import { ensureProfile } from './profile';
import { ensureRegion } from './region';

export async function ensureMandatorySettings(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  const profileSet = await ensureProfile(uiFactory, settings);
  const regionSet = await ensureRegion(makeMRU, uiFactory, settings);
  return profileSet && regionSet;
}
