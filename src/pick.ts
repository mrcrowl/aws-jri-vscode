import {
  Disposable,
  env,
  QuickPick,
  QuickPickItem,
  QuickPickItemButtonEvent,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
} from 'vscode';
import { IAuthHooks } from './aws/common/auth';
import { MaybeCacheArray } from './aws/common/cache';
import { assertIsErrorLike, ErrorLike } from './error';
import { Resource, ResourceType } from './resource';
import { partition } from './tools/array';
import { defer } from './tools/async';

export interface IPickUI {
  showErrorMessage(message: string): Promise<void>;
  createQuickPick<T extends QuickPickItem>(): QuickPick<T>;
}

interface ResourceQuickPickItem extends QuickPickItem {
  variant: 'resource';
  url: string;
  resource: Resource;
}

interface SeparatorItem extends QuickPickItem {
  variant: 'separator';
}

interface SwitchProfileQuickPickItem extends QuickPickItem {
  variant: 'profile';
  profile: string;
}

type VariousQuickPickItem = ResourceQuickPickItem | SeparatorItem | SwitchProfileQuickPickItem;

const CLEAR = new ThemeIcon('search-remove');
const SEPARATOR: SeparatorItem = { label: '', kind: QuickPickItemKind.Separator, variant: 'separator' };

export interface ISettings {
  /** Selected profile */
  readonly profile: string | undefined;
  setProfile(profile: string): Promise<void>;
  readonly configFilepath: string;
  enumerateProfileNames(): string[] | undefined;
  isProfileName(name: string): boolean;
  dispose(): void;
}

export interface IResourceMRU {
  /** Get recently selected URLs for `resourceType`. */
  getRecentlySelectedUrls(): string[];

  /** Register a URL as having been selected for `resourceType`. */
  notifyUrlSelected(url: string): Promise<void>;

  /** Clear a URL as having been selected for `resourceType`. */
  clearRecentUrl(url: string): Promise<void>;

  /** Is URL in recently selected set? */
  isRecentUrl(url: string): boolean;

  /** Gets the index of the MRU URL. */
  indexOf(url: string): number;
}

export interface ResourceLoadOptions {
  region: string;
  loginHooks: IAuthHooks;
  settings: ISettings;
  skipCache?: boolean;
}

type PickerParams = {
  ui: IPickUI;
  resourceType: ResourceType;
  region: string;
  settings: ISettings;
  mru: IResourceMRU;
  filterText?: string;
  activeItemURL?: string;
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<Resource>>;
  onSelected?: (resource: Resource) => any | PromiseLike<any>;
};
export async function pick(params: PickerParams): Promise<ResourceQuickPickItem | undefined> {
  const deferred = defer<ResourceQuickPickItem | undefined>();

  const { ui, resourceType, region, loadResources, settings, mru, onSelected } = params;

  const picker = ui.createQuickPick<VariousQuickPickItem>();
  picker.busy = true;
  picker.value = params.filterText ?? '';

  const clearButton = { iconPath: CLEAR, tooltip: `Remove this ${resourceType} from recent list` };

  function makeQuickPickItem(item: Resource): ResourceQuickPickItem {
    const isRecent = mru.isRecentUrl(item.url);

    return {
      variant: 'resource',
      label: item.name,
      description: item.description,
      url: item.url,
      buttons: isRecent ? [clearButton] : [],
      resource: item,
    };
  }

  function makeProfileItem(profileName: string): SwitchProfileQuickPickItem {
    return {
      variant: 'profile',
      label: `@${profileName}`,
      profile: profileName,
      description: `Switch to ${profileName} profile`,
    };
  }

  function tryParseProfileName(value: string): string | undefined {
    if (value.length > 1 && value.startsWith('@')) {
      const namePart = value.slice(1);
      if (settings.isProfileName(namePart)) {
        return namePart;
      }
    }

    return undefined;
  }

  const disposables: Disposable[] = [];
  const dispose = () => disposables.forEach(d => d.dispose());

  (async () => {
    let lastResources: Resource[] = [];
    let profileName: string | undefined;

    function makePickItems(resources: Resource[], numRecent: number) {
      const items: ResourceQuickPickItem[] = resources.map(makeQuickPickItem);
      const itemsBefore = items.slice(0, numRecent);
      const itemsAfter = items.slice(numRecent);

      if (profileName) {
        const profileItem = makeProfileItem(profileName);
        return [profileItem, ...itemsBefore, SEPARATOR, ...itemsAfter];
      }

      return [...itemsBefore, SEPARATOR, ...itemsAfter];
    }

    async function onDidAccept() {
      const item = picker.selectedItems[0];
      if (!item) return;
      if (item.variant === 'resource' && !item.url) return;

      switch (item.variant) {
        case 'resource':
          await onDidAcceptResource(item);
          break;

        case 'profile':
          await onDidAcceptSwitchProfile(item);
          break;
      }
    }

    async function onDidAcceptSwitchProfile(item: SwitchProfileQuickPickItem) {
      await settings.setProfile(item.profile);
      await pick(params);
    }

    async function onDidAcceptResource(item: ResourceQuickPickItem) {
      await mru.notifyUrlSelected(item.url);

      if (onSelected) {
        try {
          const { finished } = await onSelected(item.resource);
          if (finished) dispose();
          else await pick({ ...params, activeItemURL: item.url, filterText: picker.value });
        } catch (e) {
          assertIsErrorLike(e);
          await ui.showErrorMessage(`Unexpected error: ${e.message}`);
          dispose();
        }
      } else {
        await env.openExternal(Uri.parse(item.url));
        dispose();
      }
      deferred.resolve(item);
    }

    function onDidHide() {
      dispose();
      deferred.resolve(undefined);
    }

    async function onDidTriggerItemButton({ button, item }: QuickPickItemButtonEvent<VariousQuickPickItem>) {
      if (item.variant === 'resource' && button === clearButton) await clearItem(item);
    }

    async function clearItem(item: ResourceQuickPickItem) {
      await mru.clearRecentUrl(item.url);
      render(lastResources);
    }

    function render(resources: readonly Resource[]) {
      const sortedResources = [...resources].sort(sortByResourceName);
      const [recent, rest] = partition(sortedResources, r => mru.isRecentUrl(r.url));

      // Sorting function for recent URLs.
      function sortByRecentOrder(a: Resource, b: Resource): number {
        const indexA = mru.indexOf(a.url) ?? Infinity;
        const indexB = mru.indexOf(b.url) ?? Infinity;
        return indexA - indexB;
      }

      const resourcesWithRecentFirst = [...recent.sort(sortByRecentOrder), ...rest];

      if (picker.items.length > 0) {
        const activeQPIs = picker.activeItems.filter(item => item.variant === 'resource') as ResourceQuickPickItem[];
        const activeItemURLs = new Set(activeQPIs.map(item => item.url));
        picker.keepScrollPosition = true;
        picker.items = makePickItems(resourcesWithRecentFirst, recent.length);
        if (activeItemURLs.size > 0) {
          picker.activeItems = picker.items.filter(item => item.variant === 'resource' && activeItemURLs.has(item.url));
        }
      }

      lastResources = resourcesWithRecentFirst;
    }

    function onDidChangeValue(value: string) {
      const previousProfileName = profileName;
      const nextProfileName = tryParseProfileName(value);
      if (nextProfileName !== previousProfileName) {
        profileName = nextProfileName;
        render(lastResources);
      }
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.onDidTriggerItemButton(onDidTriggerItemButton, undefined, disposables);
    picker.onDidChangeValue(onDidChangeValue, undefined, disposables);
    picker.show();
    picker.placeholder = `Loading ${resourceType}s... (@${settings.profile})`;

    const hooks = makeQuickPickAuthHooks(picker);
    const resources = await loadResources({ loginHooks: hooks, region: region, skipCache: false, settings });
    picker.items = resources.sort(sortByResourceName).map(makeQuickPickItem);
    if (params.activeItemURL) {
      picker.activeItems = picker.items.filter(
        item => item.variant === 'resource' && item.url === params.activeItemURL,
      );
    }
    const plural = resources.length === 1 ? '' : 's';
    picker.placeholder = `Found ${resources.length} ${resourceType}${plural} for @${settings.profile}`;
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
  })().catch(deferred.reject);

  return deferred.promise;
}

function sortByResourceName(a: Resource, b: Resource): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
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
