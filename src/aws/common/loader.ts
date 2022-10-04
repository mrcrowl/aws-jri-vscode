import { Resource } from '../../model/resource';
import { ResourceLoadOptions } from '../../ui/pick';
import { runAWSCommandWithAuthentication } from './auth';
import { ResourceCache } from './cache';

export interface ResourceLoader {
  (options: ResourceLoadOptions): Promise<Resource[]>;
}

export interface ResourceLoaderDefinition<I, T> {
  init(options: ResourceLoadOptions): I;
  enumerate(init: I, options: ResourceLoadOptions): AsyncGenerator<T>;
  map(item: T, region: string): Resource;
}

export function makeResourceLoader<I, T>(definition: ResourceLoaderDefinition<I, T>): ResourceLoader {
  const cache = new ResourceCache();
  return async (options: ResourceLoadOptions) => {
    const { region, skipCache } = options;
    if (!skipCache) {
      const cached = cache.get(region, process.env.AWS_PROFILE);
      if (cached) return cached;
    }

    const resources: Resource[] = [];

    const init = definition.init(options);
    await runAWSCommandWithAuthentication(
      async () => {
        for await (const item of definition.enumerate(init, options)) {
          resources.push(definition.map(item, region));
        }
      },
      options.loginHooks,
      options.settings,
    );

    cache.set(region, process.env.AWS_PROFILE, resources);

    return resources;
  };
}
