import * as secrets from '@aws-sdk/client-secrets-manager';
import { window } from 'vscode';
import { assertIsErrorLike } from '../error';
import { IResourceMRU, ISettings, makeQuickPickAuthHooks, pick, ResourceLoadOptions } from '../pick';
import { ensureProfile } from '../profile';
import { Resource } from '../resource';
import { IValueRepository, showViewAndEditMenu } from '../view-and-edit-menu';
import { runAWSCommandWithAuthentication, IAuthHooks } from './common/auth';
import { ResourceCache } from './common/cache';

export async function showSecrets(mru: IResourceMRU, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;

  try {
    await pick({
      resourceType: 'secret',
      region: 'ap-southeast-2',
      loadResources: getSecrets,
      mru,
      settings,
      onSelected: (secret: Resource) => {
        const readerWriter = new SecretsManagerValueRepository(secret.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'secret',
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

export async function getSecrets({
  region,
  loginHooks,
  skipCache,
  settings,
}: ResourceLoadOptions): Promise<Resource[]> {
  if (!skipCache) {
    const cached = ecsCache.get(region, process.env.AWS_PROFILE);
    if (cached) return cached;
  }

  const secretsClient = new secrets.SecretsManager({ region });
  const response = await runAWSCommandWithAuthentication(
    () => secretsClient.send(new secrets.ListSecretsCommand({ MaxResults: 100 })),
    loginHooks,
    settings,
  );
  const resources = response.SecretList?.map(b => makeSecretResource(region, b)) ?? [];
  ecsCache.set(region, process.env.AWS_PROFILE, resources);
  return resources;
}

function makeSecretResource(region: string, entry: secrets.SecretListEntry): Resource {
  return {
    name: entry.Name ?? 'Unknown',
    description: entry.Description ?? '',
    url: `https://${region}.console.aws.amazon.com/secretsmanager/secret?name=${entry?.Name}&region=${region}`,
    arn: entry.ARN,
  };
}

class SecretsManagerValueRepository implements IValueRepository {
  private readonly client: secrets.SecretsManagerClient;

  constructor(private readonly id: string, readonly region: string) {
    this.client = new secrets.SecretsManagerClient({ region });
  }

  async retrieveValue(): Promise<string | undefined> {
    const response = await this.client.send(new secrets.GetSecretValueCommand({ SecretId: this.id }));
    return response.SecretString;
  }

  async updateValue(value: string): Promise<void> {
    const put = new secrets.PutSecretValueCommand({ SecretId: this.id, SecretString: value });
    await this.client.send(put);
  }
}
