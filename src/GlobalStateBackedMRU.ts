import { ExtensionContext } from 'vscode';
import { IResourceMRU } from './pick';

export class GlobalStateBackedMRU implements IResourceMRU {
  #setCache = new Map<string, Set<string>>();

  constructor(private readonly context: ExtensionContext) {}

  getRecentlySelectedUrls(resourceType: string): string[] {
    const urls = this.context.globalState.get(`recent_urls:${resourceType}`, []);
    return urls;
  }

  async notifyUrlSelected(resourceType: string, url: string): Promise<void> {
    const recentUrls = this.getRecentlySelectedUrls(resourceType);

    // Where to insert?
    const indexOfUrl = recentUrls.indexOf(url);
    if (indexOfUrl === -1) {
      // New URL: insert at front of list.
      recentUrls.unshift(url);
    } else {
      // Existing URL: move to front of list.
      recentUrls.unshift(...recentUrls.splice(indexOfUrl, 1));
    }

    await this.context.globalState.update(`recent_urls:${resourceType}`, recentUrls);
    this.#setCache.delete(resourceType);
  }

  async clearRecentUrl(resourceType: string, url: string): Promise<void> {
    const recentUrls = this.getRecentlySelectedUrls(resourceType);

    const indexOfUrl = recentUrls.indexOf(url);
    if (indexOfUrl === -1) return;

    recentUrls.splice(indexOfUrl, 1);

    await this.context.globalState.update(`recent_urls:${resourceType}`, recentUrls);
    this.#setCache.delete(resourceType);
  }

  isRecentUrl(resourceType: string, url: string): boolean {
    let recentUrlSet = this.#setCache.get(resourceType);
    if (!recentUrlSet) {
      recentUrlSet = new Set(this.getRecentlySelectedUrls(resourceType));
      this.#setCache.set(resourceType, recentUrlSet);
    }

    return recentUrlSet.has(url);
  }
}
