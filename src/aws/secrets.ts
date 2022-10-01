import * as secrets from '@aws-sdk/client-secrets-manager';
import { window } from 'vscode';
import { assertIsErrorLike } from '../error';
import { MRUFactoryFn } from '../mru';
import { ISettings, pick } from '../pick';
import { ensureProfile } from '../profile';
import { Resource } from '../resource';
import { IUIFactory } from '../ui/factory';
import { IValueRepository, showViewAndEditMenu } from '../view-and-edit-menu';
import { makeResourceLoader } from './common/loader';

export async function showSecrets(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  if (!(await ensureProfile(uiFactory.makeProfileUI(), settings))) return;

  try {
    await pick({
      resourceType: 'secret',
      region: 'ap-southeast-2',
      mru: makeMRU('secret'),
      settings,
      loadResources: getSecrets,
      onSelected: (secret: Resource) => {
        const readerWriter = new SecretsManagerValueRepository(secret.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'secret',
          resource: secret,
          valueRepository: readerWriter,
          settings,
        });
      },
    });
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

const getSecrets = makeResourceLoader<secrets.SecretsManagerClient, secrets.SecretListEntry>({
  init: ({ region }) => new secrets.SecretsManagerClient({ region }),

  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(new secrets.ListSecretsCommand({ NextToken: nextToken }));
      yield* response.SecretList ?? [];
      nextToken = response.NextToken;
    } while (nextToken);
  },

  map(secret: secrets.SecretListEntry, region: string) {
    return {
      name: secret.Name ?? 'Unknown',
      description: secret.Description ?? '',
      url: `https://${region}.console.aws.amazon.com/secretsmanager/secret?name=${secret?.Name}&region=${region}`,
      arn: secret.ARN,
    };
  },
});

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
