import { beforeEach, describe, expect, it } from 'vitest';
import { IKeyValueStorage, ITextMRU } from '../ui/interfaces';
import { MRU } from './mru';

const RECENT_URLS_KEY = 'mru:bucket';
const AMAZON_URL = 'https://amazon.com';
const APPLE_URL = 'https://apple.com';
const GOOGLE_URL = 'https://google.com';
const META_URL = 'https://meta.com';
const EXAMPLE_URLS: readonly string[] = [
  AMAZON_URL, //
  APPLE_URL,
  GOOGLE_URL,
];

class InMemoryStorage implements IKeyValueStorage {
  private readonly storedValues = new Map<string, unknown>();

  clear() {
    this.storedValues.clear();
  }

  get<T>(key: string, defaultValue: T): T {
    return (this.storedValues.get(key) as T) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storedValues.set(key, value);
  }
}

describe('MRU', () => {
  let mru: ITextMRU;
  let storage: IKeyValueStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();

    mru = new MRU(storage, 'bucket');
  });

  describe('getRecentlySelected', () => {
    it('returns empty array when no URLs stores', () => {
      const urls = mru.getRecentlySelected(); // Act
      expect(urls).toEqual([]); // Assert
    });

    it('returns array of URLs', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const urls = mru.getRecentlySelected(); // Act
      expect(urls).toEqual(EXAMPLE_URLS); // Assert
    });
  });

  describe('cache invalidations', () => {
    it('remains in a consistents state after multiple operaitons', async () => {
      // Arrange
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS);
      const urlsBefore = mru.getRecentlySelected();
      expect(urlsBefore).toEqual(EXAMPLE_URLS);

      // Act.
      await mru.notifySelected(META_URL);
      await mru.notifySelected(GOOGLE_URL);
      await mru.notifySelected(AMAZON_URL);
      expect(mru.indexOf(META_URL)).toBe(2);
      expect(mru.isRecent(APPLE_URL)).toBe(true);
      await mru.clearRecent(APPLE_URL);
      await mru.notifySelected(META_URL);

      // Assert.
      expect(mru.getRecentlySelected()).toEqual([META_URL, AMAZON_URL, GOOGLE_URL]);
      expect(mru.indexOf(META_URL)).toBe(0);
      expect(mru.indexOf(AMAZON_URL)).toBe(1);
      expect(mru.indexOf(GOOGLE_URL)).toBe(2);
      expect(mru.indexOf(APPLE_URL)).toBe(-1);
      expect(mru.isRecent(APPLE_URL)).toBe(false);
    });
  });

  describe('notifySelected', () => {
    it('inserts a new URL at the front of the list', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      await mru.notifySelected(META_URL); // Act
      expect(mru.getRecentlySelected()).toEqual([META_URL, AMAZON_URL, APPLE_URL, GOOGLE_URL]); // Assert
    });

    it('moves an existing URL to the front of the list', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      await mru.notifySelected(GOOGLE_URL); // Act
      expect(mru.getRecentlySelected()).toEqual([GOOGLE_URL, AMAZON_URL, APPLE_URL]); // Assert
    });
  });

  describe('clearRecent', () => {
    it('returns array of URLs', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      await mru.clearRecent(APPLE_URL); // Act
      expect(mru.getRecentlySelected()).toEqual([AMAZON_URL, GOOGLE_URL]); // Assert
    });
  });

  describe('isRecent', () => {
    it('returns true if a URL is in the list', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const isRecent = mru.isRecent(APPLE_URL); // Act
      expect(isRecent).toBe(true); // Assert
    });

    it('returns false if a URL is not in the list', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const isRecent = mru.isRecent(META_URL); // Act
      expect(isRecent).toBe(false); // Assert
    });
  });

  describe('indexOf', () => {
    it('returns 0 for the first URL', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const index = mru.indexOf(AMAZON_URL); // Act
      expect(index).toBe(0); // Assert
    });

    it('returns 1 for the second URL', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const index = mru.indexOf(APPLE_URL); // Act
      expect(index).toBe(1); // Assert
    });

    it('returns -1 for a missing URL', async () => {
      await storage.update(RECENT_URLS_KEY, EXAMPLE_URLS); // Arrange
      const index = mru.indexOf(META_URL); // Act
      expect(index).toBe(-1); // Assert
    });
  });
});
