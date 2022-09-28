import { ExtensionContext } from 'vscode';
import { IResourceMRU } from './pick';
import { ResourceType } from './resource';

export type MRUFactoryFn = (type: ResourceType) => IResourceMRU;

export class GlobalStateBackedMRU implements IResourceMRU {
  #isRecentUrlCache: Set<string> | undefined;
  #indexOfCache: Map<string, number> | undefined;

  constructor(private readonly context: ExtensionContext, private readonly resourceType: ResourceType) {}

  private get globalStateKey(): string {
    return `recent_urls:${this.resourceType}`;
  }

  getRecentlySelectedUrls(): string[] {
    const urls = this.context.globalState.get(this.globalStateKey, []);
    console.log(JSON.stringify(urls, null, 2));
    const result: string[] = [];
    for (const url of urls) {
      if (typeof url === 'string') {
        result.push(url);
      }
    }
    return result;
  }

  async notifyUrlSelected(url: string): Promise<void> {
    console.log(`notify: ${url}`);
    await this.replace(recentUrls => {
      const indexOfUrl = recentUrls.indexOf(url);
      if (indexOfUrl === -1) {
        // New URL: insert at front of list.
        return [url, ...recentUrls];
      }

      // Existing URL: move to front of list.
      recentUrls.splice(indexOfUrl, 1);
      return [url, ...recentUrls];
    });
  }

  clearRecentUrl(urlToClear: string): Promise<void> {
    return this.replace(urls => urls.filter(url => url !== urlToClear));
  }

  isRecentUrl(url: string): boolean {
    console.debug(`isRecentURL: ${url}`);
    if (!this.#isRecentUrlCache) {
      const recentURLs = this.getRecentlySelectedUrls();
      this.#isRecentUrlCache = new Set(recentURLs);
    }

    return this.#isRecentUrlCache.has(url);
  }

  indexOf(url: string): number {
    if (!this.#indexOfCache) {
      const urls = this.getRecentlySelectedUrls();
      this.#indexOfCache = new Map(urls.map((url, i) => [url, i]));
    }

    return this.#indexOfCache.get(url) ?? -1;
  }

  private async replace(generator: (recentUrls: string[]) => string[] | undefined) {
    const previousRecentUrls = this.getRecentlySelectedUrls();

    const nextRecentUrls = generator(previousRecentUrls);
    if (nextRecentUrls) {
      await this.context.globalState.update(this.globalStateKey, nextRecentUrls.slice(0, 10));
      this.invalidateCaches();
    }
  }

  private invalidateCaches() {
    this.#isRecentUrlCache = undefined;
    this.#indexOfCache = undefined;
  }
}