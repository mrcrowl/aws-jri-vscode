import type { Disposable, QuickPick, QuickPickItem, QuickPickItemButtonEvent } from 'vscode';
import { IAuthHooks } from '../aws/common/auth';
import { MaybeCacheArray } from '../aws/common/cache';
import { Resource, ResourceType } from '../model/resource';
import { partition } from '../tools/array';
import { defer } from '../tools/async';
import { assertIsErrorLike, ErrorLike } from '../tools/error';
import { FakeThemeIcon, ISettings, SeparatorItem } from './interfaces';

export interface IPickUI {
  showErrorMessage(message: string): Promise<void>;
  createQuickPick<T extends QuickPickItem>(): QuickPick<T>;
  openUrl(url: string): Promise<boolean>;
  readonly clearIcon: FakeThemeIcon;
  readonly separator: SeparatorItem;
}

export interface SelectResourceQuickPickItem extends QuickPickItem {
  variant: 'resource:select';
  url: string;
  resource: Resource;
}

export interface SwitchProfileQuickPickItem extends QuickPickItem {
  variant: 'profile:switch';
  profile: string;
}

export interface CreateResourceQuickPickItem extends QuickPickItem {
  variant: 'resource:create';
}

export type VariousQuickPickItem =
  | SelectResourceQuickPickItem
  | SeparatorItem
  | SwitchProfileQuickPickItem
  | CreateResourceQuickPickItem;

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
  profile?: string;
  loginHooks: IAuthHooks;
  settings: ISettings;
  skipCache?: boolean;
}

export type PickParams = {
  ui: IPickUI;
  resourceType: ResourceType;
  region: string;
  settings: ISettings;
  mru: IResourceMRU;
  filterText?: string;
  activeItemURL?: string;
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<Resource>>;
  onSelected?: (resource: Resource) => { finished: boolean } | PromiseLike<{ finished: boolean }>;
  onUnmatched?: (text: string) => { finished: boolean } | PromiseLike<{ finished: boolean }>;
};
export async function pick(params: PickParams): Promise<SelectResourceQuickPickItem | undefined> {
  const deferred = defer<SelectResourceQuickPickItem | undefined>();

  const { ui, resourceType, region, loadResources, settings, mru, onSelected, onUnmatched } = params;

  const picker = ui.createQuickPick<VariousQuickPickItem>();
  picker.busy = true;
  picker.value = params.filterText ?? '';

  const clearButton = { iconPath: ui.clearIcon, tooltip: `Remove this ${resourceType} from recent list` };

  function makeQuickPickItem(item: Resource): SelectResourceQuickPickItem {
    const isRecent = mru.isRecentUrl(item.url);

    return {
      variant: 'resource:select',
      label: item.name,
      description: item.description,
      url: item.url,
      buttons: isRecent ? [clearButton] : [],
      resource: item,
    };
  }

  function makeProfileItem(profileName: string): SwitchProfileQuickPickItem {
    return {
      variant: 'profile:switch',
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
  const CREATE_ITEM: CreateResourceQuickPickItem = {
    label: `$(plus) Create new ${resourceType} @${params.settings.profile}...`,
    variant: 'resource:create',
    alwaysShow: true,
  };

  (async () => {
    let lastResources: Resource[] = [];
    let profileName: string | undefined;

    function makeQuickPickItems(resources: Resource[], numRecent: number) {
      const items: SelectResourceQuickPickItem[] = resources.map(makeQuickPickItem);
      const itemsBefore = items.slice(0, numRecent);
      const itemsAfter = items.slice(numRecent);
      const separatedItems: VariousQuickPickItem[] = [...itemsBefore, ui.separator, ...itemsAfter];

      if (profileName) {
        const profileItem = makeProfileItem(profileName);
        separatedItems.unshift(profileItem);
      }

      if (onUnmatched) {
        separatedItems.push(CREATE_ITEM);
      }

      return separatedItems;
    }

    function onDidChangeValue(value: string) {
      // Profile shortcut: e.g. `@dev`
      const previousProfileName = profileName;
      const nextProfileName = tryParseProfileName(value);
      if (nextProfileName !== previousProfileName) {
        profileName = nextProfileName;
        render(lastResources);
      }
    }

    async function onDidAccept() {
      const item = picker.selectedItems[0];
      if (!item) return;
      if (item.variant === 'resource:select' && !item.url) return;

      switch (item.variant) {
        case 'resource:select':
          await selectResource(item);
          break;

        case 'resource:create':
          await addResource();
          picker.hide();
          break;

        case 'profile:switch':
          await switchProfile(item);
          break;
      }
    }

    async function addResource() {
      if (onUnmatched) {
        try {
          const { finished } = await onUnmatched(picker.value);
          if (finished) dispose();
          else await pick({ ...params, filterText: picker.value });
        } catch (e) {
          assertIsErrorLike(e);
          await ui.showErrorMessage(`Unexpected error adding resource: ${e.message}`);
          dispose();
        }
      }
      deferred.resolve(undefined);
    }

    async function switchProfile(item: SwitchProfileQuickPickItem) {
      await settings.setProfile(item.profile);
      await pick(params);
    }

    async function selectResource(item: SelectResourceQuickPickItem) {
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
        await ui.openUrl(item.url);
        dispose();
      }
      deferred.resolve(item);
    }

    function onDidHide() {
      dispose();
      deferred.resolve(undefined);
    }

    async function onDidTriggerItemButton({ button, item }: QuickPickItemButtonEvent<VariousQuickPickItem>) {
      if (item.variant === 'resource:select' && button === clearButton) await clearItem(item);
    }

    async function clearItem(item: SelectResourceQuickPickItem) {
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
        const activeQPIs = picker.activeItems.filter(
          item => item.variant === 'resource:select',
        ) as SelectResourceQuickPickItem[];
        const activeItemURLs = new Set(activeQPIs.map(item => item.url));
        picker.keepScrollPosition = true;
        picker.items = makeQuickPickItems(resourcesWithRecentFirst, recent.length);
        if (activeItemURLs.size > 0) {
          picker.activeItems = picker.items.filter(
            item => item.variant === 'resource:select' && activeItemURLs.has(item.url),
          );
        }
      }

      lastResources = resourcesWithRecentFirst;
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.onDidTriggerItemButton(onDidTriggerItemButton, undefined, disposables);
    picker.onDidChangeValue(onDidChangeValue, undefined, disposables);
    picker.show();
    picker.placeholder = `Loading ${resourceType}s... (@${settings.profile})`;

    const hooks = makeQuickPickAuthHooks(picker);
    const resources = await loadResources({
      loginHooks: hooks,
      region: region,
      profile: settings.profile,
      skipCache: false,
      settings,
    });
    picker.items = resources.sort(sortByResourceName).map(makeQuickPickItem);
    if (params.activeItemURL) {
      picker.activeItems = picker.items.filter(
        item => item.variant === 'resource:select' && item.url === params.activeItemURL,
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
        profile: settings.profile,
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
  let oldPlaceholder = picker.placeholder;

  return {
    onAttempt() {
      picker.ignoreFocusOut = true;
      picker.placeholder = 'Waiting for login via SSO (external browser) ...';
    },
    onSuccess() {
      picker.ignoreFocusOut = false;
      picker.placeholder = oldPlaceholder;
    },
    onFailure(_: ErrorLike) {
      picker.ignoreFocusOut = false;
      picker.placeholder = oldPlaceholder;
    },
  };
}
