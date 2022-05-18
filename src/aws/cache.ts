import { MaybeCacheArray, Resource } from "../pick";

export class ResourceCache {
  private cache = new Map<string, MaybeCacheArray<Resource>>();

  private static makeCacheKey(region: string, profile: string | undefined): string {
    return `${profile ?? ""}:${region}`;
  }

  set(region: string, profile: string | undefined, resources: readonly Resource[]) {
    const cacheKey = ResourceCache.makeCacheKey(region, profile);
    const cachedArray: MaybeCacheArray<Resource> = [...resources];
    cachedArray.fromCache = true;
    return this.cache.set(cacheKey, cachedArray);
  }

  get(region: string, profile: string | undefined): MaybeCacheArray<Resource> | undefined {
    const cacheKey = ResourceCache.makeCacheKey(region, profile);
    return this.cache.get(cacheKey);
  }
}
