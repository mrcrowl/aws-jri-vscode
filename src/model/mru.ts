import type { IKeyValueStorage, ITextMRU } from '../ui/interfaces';
import { ResourceType } from './resource';

export type MRUKeys = ResourceType | string;
export type MRUFactoryFn = (key: MRUKeys) => ITextMRU;

export class MRU implements ITextMRU {
  #isRecentCache: Set<string> | undefined;
  #indexOfCache: Map<string, number> | undefined;

  constructor(private readonly storage: IKeyValueStorage, private readonly key: string) {}

  private get globalStateKey(): string {
    return `mru:${this.key}`;
  }

  getRecentlySelected(): string[] {
    const texts = this.storage.get(this.globalStateKey, []);
    const result: string[] = [];
    for (const text of texts) {
      if (typeof text === 'string') {
        result.push(text);
      }
    }
    return result;
  }

  async notifySelected(text: string): Promise<void> {
    await this.replace(recentTexts => {
      const indexOfText = recentTexts.indexOf(text);
      if (indexOfText === -1) {
        // New text: insert at front of list.
        return [text, ...recentTexts];
      }

      // Existing text: move to front of list.
      recentTexts.splice(indexOfText, 1);
      return [text, ...recentTexts];
    });
  }

  clearRecent(textToClear: string): Promise<void> {
    return this.replace(texts => texts.filter(text => text !== textToClear));
  }

  isRecent(text: string): boolean {
    if (!this.#isRecentCache) {
      const recentlySelected = this.getRecentlySelected();
      this.#isRecentCache = new Set(recentlySelected);
    }

    return this.#isRecentCache.has(text);
  }

  indexOf(text: string): number {
    if (!this.#indexOfCache) {
      const recentlySelected = this.getRecentlySelected();
      this.#indexOfCache = new Map(recentlySelected.map((text, i) => [text, i]));
    }

    return this.#indexOfCache.get(text) ?? -1;
  }

  private async replace(generator: (recentlySelected: string[]) => string[] | undefined) {
    const previouslyRecentlySelected = this.getRecentlySelected();

    const nextRecentlySelected = generator(previouslyRecentlySelected);
    if (nextRecentlySelected) {
      await this.storage.update(this.globalStateKey, nextRecentlySelected.slice(0, 10));
      this.invalidateCaches();
    }
  }

  private invalidateCaches() {
    this.#isRecentCache = undefined;
    this.#indexOfCache = undefined;
  }
}
