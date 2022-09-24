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
import { ErrorLike } from './error';
import { Resource } from './resource';
export interface ResourceQuickPickItem extends QuickPickItem {
  url: string;
}

const PINNED = new ThemeIcon('pinned');
const PIN = new ThemeIcon('pin');
const SEPARATOR: ResourceQuickPickItem = { label: '', kind: QuickPickItemKind.Separator, url: '' };

/** Manages pinned urls. */
export interface IPinner {
  isPinned(url: string): boolean;
  pin(url: string): void;
  unpin(url: string): void;
}

export interface ISettings {
  readonly profile: string | undefined;
  setProfile(profile: string): Promise<void>;
}

export interface ResourceLoadOptions {
  region: string;
  loginHooks: IAuthHooks;
  settings: ISettings;
  skipCache?: boolean;
}

export async function pick<T extends Resource>(
  resourceType: string,
  region: string,
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<T>>,
  pinner: IPinner,
  settings: ISettings,
): Promise<ResourceQuickPickItem | undefined> {
  console.log(settings);

  const picker = window.createQuickPick<ResourceQuickPickItem>();
  picker.busy = true;

  const pinButton = { iconPath: PIN, tooltip: 'Pin this ${resourceType}' };
  const unpinButton = { iconPath: PINNED, tooltip: 'Unpin' };

  function resourceToQuickPickItem(item: Resource): ResourceQuickPickItem {
    const isPinned = pinner.isPinned(item.url);

    return {
      label: item.name,
      description: item.description,
      url: item.url,
      buttons: [isPinned ? unpinButton : pinButton],
      alwaysShow: isPinned,
    };
  }

  return new Promise(async resolve => {
    const disposables: Disposable[] = [];
    let lastResources: Resource[] = [];

    async function onDidAccept() {
      dispose();
      const item = picker.selectedItems[0];
      if (!item || !item.url) return;
      await env.openExternal(Uri.parse(item.url));
      resolve(item);
    }

    function onDidHide() {
      dispose();
      resolve(undefined);
    }

    function onDidTriggerItemButtion({ button, item }: QuickPickItemButtonEvent<ResourceQuickPickItem>) {
      // prettier-ignore
      switch (button) {
        case pinButton: return pinItem(item);
        case unpinButton: return unpinItem(item);
      }
    }

    function pinItem(item: ResourceQuickPickItem) {
      pinner.pin(item.url);
      render(lastResources);
    }

    function unpinItem(item: ResourceQuickPickItem) {
      pinner.unpin(item.url);
      render(lastResources);
    }

    function dispose() {
      disposables.forEach(d => d.dispose());
    }

    function render(resources: readonly Resource[]) {
      const sortedResources = [...resources].sort(sortByResourceName);
      const [pinned, unpinned] = partition(sortedResources, r => pinner.isPinned(r.url));
      const groupedResources = [...pinned, ...unpinned];

      if (picker.items.length > 0) {
        const freshItemURLs = groupedResources.map(item => item.url);
        const existingItemURLs = picker.items.map(item => item.url);
        if (!sameURLsInTheSameOrder(freshItemURLs, existingItemURLs)) {
          const activeItemURLs = new Set(picker.activeItems.map(item => item.url));
          picker.keepScrollPosition = true;
          let quickPickItems = groupedResources.map(resourceToQuickPickItem);
          picker.items = [...quickPickItems.slice(0, pinned.length), SEPARATOR, ...quickPickItems.slice(pinned.length)];
          if (activeItemURLs.size > 0) {
            picker.activeItems = picker.items.filter(item => activeItemURLs.has(item.url));
          }
        } else {
          // No update required.
        }
      } else {
        let quickPickItems = groupedResources.map(resourceToQuickPickItem);
        picker.items = [...quickPickItems.slice(0, pinned.length), SEPARATOR, ...quickPickItems.slice(pinned.length)];
      }

      lastResources = groupedResources;
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.onDidTriggerItemButton(onDidTriggerItemButtion, undefined, disposables);
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
