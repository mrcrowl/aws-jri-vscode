import { anyString, instance, mock, reset, verify, when } from 'ts-mockito';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaybeCacheArray } from './aws/common/cache';
import { MRU } from './mru';
import { IPickUI, ISettings, pick, PickParams, ResourceLoadOptions, VariousQuickPickItem } from './pick';
import { Resource } from './resource';
import { sleep } from './tools/async';
import { SeparatorItem } from './ui/interfaces';
import { FakeQuickPick, FakeStorage } from './__test__/fakes';

const RESOURCES = makeResources('A', 'B', 'C', 'D');
const [RESOURCE_A, RESOURCE_B, RESOURCE_C, RESOURCE_D] = RESOURCES;
const SEPARATOR: SeparatorItem = { label: '', kind: -1, variant: 'separator' };

const mockLoadResourcesFn = vi.fn().mockImplementation(async ({ skipCache }: ResourceLoadOptions) => {
  const resources: MaybeCacheArray<Resource> = [...RESOURCES];
  resources.fromCache = !skipCache;
  return resources;
});

describe('pick', () => {
  const ui = mock<IPickUI>();
  const settings = mock<ISettings>();

  let storage: FakeStorage;
  let mru: MRU;
  let picker: FakeQuickPick;
  let profile: string;

  beforeEach(async () => {
    // Reset.
    vi.clearAllMocks();
    reset(ui);
    reset(settings);

    // UI.
    when(ui.separator).thenReturn(SEPARATOR);

    // Settings.
    profile = 'dev';
    when(settings.profile).thenCall(() => profile);
    when(settings.setProfile(anyString())).thenCall(nextProfile => (profile = nextProfile));
    when(settings.isProfileName(anyString())).thenCall(profile => ['dev', 'test', 'prod'].includes(profile));

    // UI: createQuickPick() --> picker
    picker = new FakeQuickPick();
    when(ui.createQuickPick()).thenReturn(picker);

    // Storage & MRU
    storage = new FakeStorage();
    mru = new MRU(storage, 'ASG');
  });

  it('basic selection', async () => {
    // Assert: "B" is not recent before.
    expect(mru.isRecentUrl(RESOURCE_B.url)).toBe(false);

    // Act: Basic picker.
    const params = makeParams();
    const promise = pick(params);

    // Act: Select "B".
    await sleep(0);
    picker.fakeSelectResourceWithUrl(RESOURCE_B.url);
    await sleep(0);

    // Assert: "B" became a recent URL.
    expect(mru.isRecentUrl(RESOURCE_B.url)).toBe(true);

    // Assert: result returns "B".
    const result = await promise;
    expect(result?.url).toBe(RESOURCE_B.url);

    // Assert: no longer busy.
    expect(picker.busy).toBe(false);

    // Assert: loadResources called twice [use cache, skip cache].
    expect(mockLoadResourcesFn).toHaveBeenCalledTimes(2);
    const [[firstLoadParams], [secondLoadParams]] = mockLoadResourcesFn.mock.calls;
    expect(firstLoadParams.skipCache).toBe(false);
    expect(secondLoadParams.skipCache).toBe(true);
  });

  it('sequences items by MRU', async () => {
    await mru.notifyUrlSelected(RESOURCE_C.url);

    const params = makeParams();
    void pick(params);
    await sleep(0);

    expect(picker.itemResources).toMatchObject([
      RESOURCE_C, //
      RESOURCE_A,
      RESOURCE_B,
      RESOURCE_D,
    ]);

    expect(picker.fakeNumRecentItems).toBe(1);
  });

  it('typing a profile name moves it to the top', async () => {
    const params = makeParams();
    const _ = pick(params);

    await sleep(0);
    picker.fakeTypeFilterText('@prod');
    await sleep(0);
    const [firstItem, ...rest] = picker.items;
    expect(firstItem.label).toBe('@prod');
    expect(firstItem.description).toBe('Switch to prod profile');

    const restAreResources = rest
      .filter(item => item.variant !== 'separator')
      .every(item => item.variant === 'resource:select');
    expect(restAreResources).toBe(true);

    picker.selectedItems = [firstItem];
    picker.fireDidAccept();
    await sleep(0);

    verify(settings.setProfile('prod')).once();

    // Assert: loadResources called twice [use cache, skip cache].
    expect(mockLoadResourcesFn).toHaveBeenCalledTimes(4);
    const [[first], [second], [third], [fourth]] = mockLoadResourcesFn.mock.calls as ResourceLoadOptions[][];
    expect(first.skipCache).toBe(false);
    expect(first.profile).toBe('dev');
    expect(second.skipCache).toBe(true);
    expect(second.profile).toBe('dev');
    expect(third.skipCache).toBe(false);
    expect(third.profile).toBe('prod');
    expect(fourth.skipCache).toBe(true);
    expect(fourth.profile).toBe('prod');
  });

  it('when onNew is specifed, the last item matches the filter text', async () => {
    let lastItem: VariousQuickPickItem | undefined;

    const params = makeParams({
      onUnmatched() {
        return { finished: true };
      },
    });
    const _ = pick(params);

    await sleep(0);

    lastItem = picker.items[picker.items.length - 1];
    expect(lastItem?.label).toMatch(/Create new/);
  });

  function makeParams(adjustments?: Partial<PickParams>) {
    const params: PickParams = {
      ui: instance(ui),
      resourceType: 'ASG',
      region: 'ap-southeast-2',
      settings: instance(settings),
      loadResources: mockLoadResourcesFn,
      mru,
      ...adjustments,
    };
    return params;
  }
});

function makeResources(...names: string[]): readonly Resource[] {
  return Object.freeze(names.map(makeResource));
}

function makeResource(name: string): Resource {
  return {
    name,
    description: '',
    url: `https://aws.resource/${name}`,
    arn: `aws:arn:123456789:${name}`,
  };
}
