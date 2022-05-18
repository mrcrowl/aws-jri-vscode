import { Disposable, env, QuickPick, QuickPickItem, Uri, window } from "vscode";
import { ErrorLike } from "./error";
import { AuthHooks } from "./aws/common/auth";
import { Resource } from "./resource";
import { MaybeCacheArray } from "./aws/common/cache";

export interface ResourceQuickPickItem extends QuickPickItem {
  url: string;
}

export function resourceToQuickPickItem(item: Resource): ResourceQuickPickItem {
  return {
    label: item.name,
    description: item.description,
    url: item.url,
  };
}

export interface ResourceLoadOptions {
  region: string;
  loginHooks: AuthHooks;
  skipCache?: boolean;
}

export async function pick<T extends Resource>(
  resourceType: string,
  region: string,
  loadResources: (options: ResourceLoadOptions) => Promise<MaybeCacheArray<T>>
): Promise<ResourceQuickPickItem | undefined> {
  const picker = window.createQuickPick<ResourceQuickPickItem>();
  picker.busy = true;

  return new Promise(async (resolve, reject) => {
    const disposables: Disposable[] = [];

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

    function dispose() {
      disposables.forEach((d) => d.dispose());
    }

    picker.onDidAccept(onDidAccept, undefined, disposables);
    picker.onDidHide(onDidHide, undefined, disposables);
    picker.show();
    picker.placeholder = `Loading ${resourceType}s...`;

    const hooks = makeQuickPickAuthHooks(picker);
    const resources = await loadResources({
      loginHooks: hooks,
      region: region,
      skipCache: false,
    });
    picker.items = resources.sort(sortByResourceName).map(resourceToQuickPickItem);
    picker.placeholder = `Found ${resources.length} ${resourceType}${
      resources.length === 1 ? "" : "s"
    }`;

    if (resources.fromCache) {
      // Reload the items without cache, in case anything has changed.
      const freshResources = await loadResources({
        loginHooks: hooks,
        region: region,
        skipCache: true,
      });
      const freshItemURLs = freshResources.map((item) => item.url);
      const existingItemURLs = picker.items.map((item) => item.url);
      if (!sameURLs(freshItemURLs, existingItemURLs)) {
        const activeItemURLs = new Set(picker.activeItems.map((item) => item.url));
        picker.keepScrollPosition = true;
        picker.items = freshResources.sort(sortByResourceName).map(resourceToQuickPickItem);
        if (activeItemURLs.size > 0) {
          picker.activeItems = picker.items.filter((item) => activeItemURLs.has(item.url));
        }
      }
    }

    picker.busy = false;
  });
}

function sortByResourceName(a: Resource, b: Resource): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sameURLs(oldURLs: readonly string[], newURLs: readonly string[]) {
  if (oldURLs.length !== newURLs.length) {
    return false;
  }

  const olds = new Set(oldURLs);
  const news = new Set(newURLs);

  for (const url of olds) {
    if (news.has(url)) {
      news.delete(url);
      olds.delete(url);
    } else {
      return false;
    }
  }

  for (const url of news) {
    if (!olds.has(url)) {
      return false;
    }
  }

  return true;
}

export function makeQuickPickAuthHooks(picker: QuickPick<QuickPickItem>): AuthHooks {
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
