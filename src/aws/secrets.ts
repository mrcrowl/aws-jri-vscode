import * as secrets from '@aws-sdk/client-secrets-manager';
import { window } from 'vscode';
import { MRUFactoryFn } from '../model/mru';
import { Resource } from '../model/resource';
import { assertIsErrorLike } from '../tools/error';
import { ISettings, IUIFactory } from '../ui/interfaces';
import { pick } from '../ui/pick';
import { ensureProfile } from '../ui/profile';
import { IValueRepository, showViewAndEditMenu } from '../ui/view-and-edit-menu';
import { makeResourceLoader } from './common/loader';

export async function showSecrets(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  if (!(await ensureProfile(uiFactory.makeProfileUI(), settings))) return;

  try {
    await pick({
      ui: uiFactory.makePickUI(),
      resourceType: 'secret',
      region: 'ap-southeast-2',
      mru: makeMRU('secret'),
      settings,
      loadResources: getSecrets,
      onSelected: (secret: Resource) => {
        const repo = new SecretsManagerValueRepository(secret.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'secret',
          resource: secret,
          valueRepository: repo,
          settings,
          uiFactory,
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

  async createValue(name: string, value: string): Promise<void> {
    const put = new secrets.PutSecretValueCommand({ SecretId: name, SecretString: value });
    await this.client.send(put);
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
