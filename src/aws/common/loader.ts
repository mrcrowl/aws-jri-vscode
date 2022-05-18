import { ResourceLoadOptions } from '../../pick';
import { ResourceCache } from './cache';
import { ensureAuthenticated } from "./auth";
import { Resource } from '../../resource';

export interface ResourceLoader {
  (options: ResourceLoadOptions): Promise<Resource[]>;
}

export interface ResourceLoaderDefinition<I, T> {
  init(options: ResourceLoadOptions): I;
  enumerate(init: I, options: ResourceLoadOptions): AsyncGenerator<T>;
  map(item: T, region: string): Resource;
}

export function makeResourceLoader<I, T>(
  definition: ResourceLoaderDefinition<I, T>
): ResourceLoader {
  const cache = new ResourceCache();
  return async (options: ResourceLoadOptions) => {
    const { region, skipCache } = options;
    if (!skipCache) {
      const cached = cache.get(region, process.env.AWS_PROFILE);
      if (cached) return cached;
    }

    const resources: Resource[] = [];

    const init = definition.init(options);
    await ensureAuthenticated(async () => {
      for await (const item of definition.enumerate(init, options)) {
        resources.push(definition.map(item, region));
      }
    }, options.loginHooks);

    cache.set(region, process.env.AWS_PROFILE, resources);

    return resources;
  };
}