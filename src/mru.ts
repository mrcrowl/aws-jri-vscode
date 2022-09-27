import { ExtensionContext } from 'vscode';
import { IResourceMRU } from './pick';
import { ResourceType } from './resource';

export type MRUFactoryFn = (type: ResourceType) => IResourceMRU;

export class GlobalStateBackedMRU implements IResourceMRU {
  #setCache = new Set<string>();
  #indexOfCache = new Map<string, number>();

  constructor(private readonly context: ExtensionContext, private readonly resourceType: ResourceType) {}

  get globalStateKey(): string {
    return `recent_urls:${this.resourceType}`;
  }

  getRecentlySelectedUrls(): string[] {
    const urls = this.context.globalState.get(this.globalStateKey, []);
    return urls;
  }

  async notifyUrlSelected(url: string): Promise<void> {
    const recentUrls = this.getRecentlySelectedUrls();

    // Where to insert?
    const indexOfUrl = recentUrls.indexOf(url);
    if (indexOfUrl === -1) {
      // New URL: insert at front of list.
      recentUrls.unshift(url);
    } else {
      // Existing URL: move to front of list.
      recentUrls.unshift(...recentUrls.splice(indexOfUrl, 1));
    }

    await this.context.globalState.update(this.globalStateKey, recentUrls);

    this.invalidateCaches();
  }

  private invalidateCaches() {
    this.#setCache.delete(this.resourceType);
    this.#indexOfCache.delete(this.resourceType);
  }

  async clearRecentUrl(url: string): Promise<void> {
    const recentUrls = this.getRecentlySelectedUrls();

    const indexOfUrl = recentUrls.indexOf(url);
    if (indexOfUrl === -1) return;

    recentUrls.splice(indexOfUrl, 1);

    await this.context.globalState.update(this.globalStateKey, recentUrls);

    this.invalidateCaches();
  }

  isRecentUrl(url: string): boolean {
    if (!this.#setCache) {
      this.#setCache = new Set(this.getRecentlySelectedUrls());
    }

    return this.#setCache.has(url);
  }

  indexOf(url: string): number {
    if (!this.#indexOfCache) {
      const urls = this.getRecentlySelectedUrls();
      this.#indexOfCache = new Map(urls.map((url, i) => [url, i]));
    }

    return this.#indexOfCache.get(url) ?? -1;
  }
}
