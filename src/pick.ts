import {
  Disposable,
  env,
  QuickPick,
  QuickPickItem,
  QuickPickItemButtonEvent,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  window,
} from 'vscode';
import { IAuthHooks } from './aws/common/auth';
import { MaybeCacheArray } from './aws/common/cache';
import { assertIsErrorLike, ErrorLike } from './error';
import { Resource } from './resource';
export interface ResourceQuickPickItem<T extends Resource> extends QuickPickItem {
  url: string;
  resource: T;
}

const CLEAR = new ThemeIcon('search-remove');
const DUMMY_RESOURCE = {} as Resource;
const SEPARATOR: ResourceQuickPickItem<Resource> = {
  label: '',
  kind: QuickPickItemKind.Separator,
  url: '',
  resource: DUMMY_RESOURCE,
};

export interface ISettings {
  /** Selected profile */
  readonly profile: string | undefined;
  setProfile(profile: string): Promise<void>;
}

export interface IResourceMRU {
  /** Get recently selected URLs for `resourceType`. */
  getRecentlySelectedUrls(resourceType: string): string[];

  /** Register a URL as having been selected for `resourceType`. */
  notifyUrlSelected(resourceType: string, url: string): Promise<void>;

  /** Clear a URL as having been selected for `resourceType`. */
  clearRecentUrl(resourceType: string, url: string): Promise<void>;

  /** Is URL in recently selected set? */
  isRecentUrl(resourceType: string, url: string): boolean;
}

export interface ResourceLoadOptions {
  region: string;
  loginHooks: IAuthHooks;
  settings: ISettings;
  skipCache?: boolean;
}

type PickerParams<R extends Resource> = {
  resourceType: string;
  region: string;
  settings: ISettings;
  mru: IResourceMRU;
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<R>>;
  onSelected?: (resource: R) => any | PromiseLike<any>;
};
export async function pick<R extends Resource>(params: PickerParams<R>): Promise<ResourceQuickPickItem<R> | undefined> {
  const { resourceType, region, loadResources, settings, mru, onSelected } = params;

  const picker = window.createQuickPick<ResourceQuickPickItem<R>>();
  picker.busy = true;

  const clearButton = { iconPath: CLEAR, tooltip: `Remove this ${resourceType} from recent list` };

  function resourceToQuickPickItem(item: R): ResourceQuickPickItem<R> {
    const isRecent = mru.isRecentUrl(resourceType, item.url);

    return {
      label: item.name,
      description: item.description,
      url: item.url,
      buttons: isRecent ? [clearButton] : [],
      resource: item,
      alwaysShow: isRecent,
    };
  }

  return new Promise(async resolve => {
    const disposables: Disposable[] = [];
    let lastResources: R[] = [];

    async function onDidAccept() {
      const item = picker.selectedItems[0];
      if (!item || !item.url) return;

      mru.notifyUrlSelected(resourceType, item.url);

      if (onSelected) {
        try {
          const { finished } = await onSelected(item.resource);
          if (finished) dispose();
          else pick(params);
        } catch (e) {
          assertIsErrorLike(e);
          window.showErrorMessage(`Unexpected error: ${e.message}`);
          dispose();
        }
      } else {
        await env.openExternal(Uri.parse(item.url));
        dispose();
      }
      resolve(item);
    }

    function onDidHide() {
      dispose();
      resolve(undefined);
    }

    async function onDidTriggerItemButton({ button, item }: QuickPickItemButtonEvent<ResourceQuickPickItem<R>>) {
      // prettier-ignore
      switch (button) {
        case clearButton: await clearItem(item);
      }
    }

    async function clearItem(item: ResourceQuickPickItem<R>) {
      await mru.clearRecentUrl(resourceType, item.url);
      render(lastResources);
    }

    function dispose() {
      disposables.forEach(d => d.dispose());
    }

    function render(resources: readonly R[]) {
      const sortedResources = [...resources].sort(sortByResourceName);
      const [recent, unrecent] = partition(sortedResources, r => mru.isRecentUrl(resourceType, r.url));

      // Sorting function for recent URLs.
      const recentUrls = mru.getRecentlySelectedUrls(resourceType);
      const indexByRecentURL = new Map(recentUrls.map((value, i) => [value, i]));
      function sortByRecentOrder(a: Resource, b: Resource): number {
        const indexA = indexByRecentURL.get(a.url) ?? Infinity;
        const indexB = indexByRecentURL.get(b.url) ?? Infinity;

        return indexB - indexA;
      }

      const groupedResources = [...recent.sort(sortByRecentOrder), ...unrecent];

      if (picker.items.length > 0) {
        const freshItemURLs = groupedResources.map(item => item.url);
        const existingItemURLs = picker.items.map(item => item.url);
        if (!sameURLsInTheSameOrder(freshItemURLs, existingItemURLs)) {
          const activeItemURLs = new Set(picker.activeItems.map(item => item.url));
          picker.keepScrollPosition = true;
          let quickPickItems = groupedResources.map(resourceToQuickPickItem);
          picker.items = [
            ...quickPickItems.slice(0, recent.length),
            SEPARATOR as ResourceQuickPickItem<R>,
            ...quickPickItems.slice(recent.length),
          ];
          if (activeItemURLs.size > 0) {
            picker.activeItems = picker.items.filter(item => activeItemURLs.has(item.url));
          }
        } else {
          // No update required.
        }
      } else {
        let quickPickItems = groupedResources.map(resourceToQuickPickItem);
        picker.items = [
          ...quickPickItems.slice(0, recent.length),
          SEPARATOR as ResourceQuickPickItem<R>,
          ...quickPickItems.slice(recent.length),
        ];
      }

      lastResources = groupedResources;
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.onDidTriggerItemButton(onDidTriggerItemButton, undefined, disposables);
    picker.show();
    picker.placeholder = `Loading ${resourceType}s... (${settings.profile})`;

    const hooks = makeQuickPickAuthHooks(picker);
    const resources = await loadResources({
      loginHooks: hooks,
      region: region,
      skipCache: false,
      settings,
    });
    picker.items = resources.sort(sortByResourceName).map(resourceToQuickPickItem);
    picker.placeholder = `Found ${resources.length} ${resourceType}${resources.length === 1 ? '' : 's'}`;
    render(resources);

    if (resources.fromCache) {
      // Reload the items without cache, in case anything has changed.
      const freshResources = await loadResources({
        loginHooks: hooks,
        region: region,
        skipCache: true,
        settings,
      });
      render(freshResources);
    }

    picker.busy = false;
  });
}

function partition<T>(list: T[], criteria: (item: T) => boolean): [hits: T[], misses: T[]] {
  const hits: T[] = [];
  const misses: T[] = [];
  for (const item of list) {
    if (criteria(item)) {
      hits.push(item);
    } else {
      misses.push(item);
    }
  }
  return [hits, misses];
}

function sortByResourceName(a: Resource, b: Resource): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sameURLsInTheSameOrder(oldURLs: readonly string[], newURLs: readonly string[]) {
  if (oldURLs.length !== newURLs.length) {
    return false;
  }

  for (let i = 0; i < oldURLs.length; i++) {
    if (oldURLs[i] !== newURLs[i]) {
      return false;
    }
  }

  return true;
}

export function makeQuickPickAuthHooks(picker: QuickPick<QuickPickItem>): IAuthHooks {
  return {
    onAttempt() {
      picker.ignoreFocusOut = true;
    },
    onSuccess() {
      picker.ignoreFocusOut = false;
    },
    onFailure(_: ErrorLike) {
      picker.ignoreFocusOut = false;
    },
  };
}
