import * as ssm from '@aws-sdk/client-ssm';
import { window } from 'vscode';
import { assertIsErrorLike } from '../error';
import { IResourceMRU, ISettings, pick, ResourceLoadOptions } from '../pick';
import { ensureProfile } from '../profile';
import { Resource } from '../resource';
import { IValueRepository, showViewAndEditMenu } from '../view-and-edit-menu';
import { runAWSListerWithAuthentication } from './common/auth';
import { ResourceCache } from './common/cache';
import { IAWSResourceLister } from './common/IAWSResourceLister';

export async function showParameters(mru: IResourceMRU, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;

  try {
    await pick({
      resourceType: 'parameter',
      region: 'ap-southeast-2',
      loadResources: getParameters,
      settings,
      mru,
      onSelected: (secret: Resource) => {
        const readerWriter = new ParameterStoreValueRepository(secret.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'parameter',
          secret,
          valueRepository: readerWriter,
          settings,
        });
      },
    });
  } catch (e) {
    assertIsErrorLike(e);
    window.showErrorMessage(e.message);
  }
}

const ecsCache = new ResourceCache();

class ParameterStoreLister implements IAWSResourceLister<ssm.ParameterMetadata> {
  #nextToken: string | undefined;
  #hasMore: boolean = true;

  constructor(private readonly client: ssm.SSMClient) {}

  get hasMore() {
    return this.#hasMore;
  }

  async fetchNextBatch(): Promise<ssm.ParameterMetadata[] | undefined> {
    const command = new ssm.DescribeParametersCommand({ MaxResults: 50, NextToken: this.#nextToken });
    const results = await this.client.send(command);
    this.#nextToken = results.NextToken;
    this.#hasMore = this.#nextToken !== undefined;
    return results.Parameters;
  }
}

export async function getParameters({
  region,
  loginHooks,
  skipCache,
  settings,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const ssmClient = new ssm.SSMClient({ region });
  const parametersLister = new ParameterStoreLister(ssmClient);
  const results = await runAWSListerWithAuthentication(parametersLister, loginHooks, settings);
  const resources = results?.map(b => makeSecretResource(region, b)) ?? [];
  ecsCache.set(region, process.env.AWS_PROFILE, resources);
  return resources;
}

function makeSecretResource(region: string, entry: ssm.Parameter): Resource {
  return {
    name: entry.Name ?? 'Unknown',
    description: '',
    url: `https://${region}.console.aws.amazon.com/secretsmanager/secret?name=${entry?.Name}&region=${region}`,
    arn: entry.ARN,
  };
}

class ParameterStoreValueRepository implements IValueRepository {
  private readonly client: ssm.SSMClient;

  constructor(private readonly id: string, readonly region: string) {
    this.client = new ssm.SSMClient({ region });
  }

  async retrieveValue(): Promise<string | undefined> {
    const response = await this.client.send(new ssm.GetParameterCommand({ Name: this.id }));
    return response.Parameter?.Value;
  }

  async updateValue(value: string): Promise<void> {
    const put = new ssm.PutParameterCommand({ Name: this.id, Value: value, Overwrite: true });
    await this.client.send(put);
  }
}
