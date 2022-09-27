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

const PINNED = new ThemeIcon('pinned');
const PIN = new ThemeIcon('pin');
const DUMMY_RESOURCE = {} as Resource;
const SEPARATOR: ResourceQuickPickItem<Resource> = {
  label: '',
  kind: QuickPickItemKind.Separator,
  url: '',
  resource: DUMMY_RESOURCE,
};

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

export async function pick<R extends Resource>(params: {
  resourceType: string;
  region: string;
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<R>>;
  pinner: IPinner;
  settings: ISettings;
  onSelected?: (resource: R) => any | PromiseLike<any>;
}): Promise<ResourceQuickPickItem<R> | undefined> {
  const { resourceType, region, loadResources, pinner, settings, onSelected } = params;
  console.log(settings);

  const picker = window.createQuickPick<ResourceQuickPickItem<R>>();
  picker.busy = true;

  const pinButton = { iconPath: PIN, tooltip: 'Pin this ${resourceType}' };
  const unpinButton = { iconPath: PINNED, tooltip: 'Unpin' };

  function resourceToQuickPickItem(item: R): ResourceQuickPickItem<R> {
    const isPinned = pinner.isPinned(item.url);

    return {
      label: item.name,
      description: item.description,
      url: item.url,
      buttons: [isPinned ? unpinButton : pinButton],
      resource: item,
      alwaysShow: isPinned,
    };
  }

  return new Promise(async resolve => {
    const disposables: Disposable[] = [];
    let lastResources: R[] = [];

    async function onDidAccept() {
      const item = picker.selectedItems[0];
      if (!item || !item.url) return;

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

    function onDidTriggerItemButton({ button, item }: QuickPickItemButtonEvent<ResourceQuickPickItem<R>>) {
      // prettier-ignore
      switch (button) {
        case pinButton: return pinItem(item);
        case unpinButton: return unpinItem(item);
      }
    }

    function pinItem(item: ResourceQuickPickItem<R>) {
      pinner.pin(item.url);
      render(lastResources);
    }

    function unpinItem(item: ResourceQuickPickItem<R>) {
      pinner.unpin(item.url);
      render(lastResources);
    }

    function dispose() {
      disposables.forEach(d => d.dispose());
    }

    function render(resources: readonly R[]) {
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
          picker.items = [
            ...quickPickItems.slice(0, pinned.length),
            SEPARATOR as ResourceQuickPickItem<R>,
            ...quickPickItems.slice(pinned.length),
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
          ...quickPickItems.slice(0, pinned.length),
          SEPARATOR as ResourceQuickPickItem<R>,
          ...quickPickItems.slice(pinned.length),
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
