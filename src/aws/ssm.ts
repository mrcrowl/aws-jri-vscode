import * as ssm from '@aws-sdk/client-ssm';
import { window } from 'vscode';
import { MRUFactoryFn } from '../model/mru';
import { Resource } from '../model/resource';
import { assertIsErrorLike } from '../tools/error';
import { createNameValuePair } from '../ui/create';
import { ISettings, IUIFactory } from '../ui/interfaces';
import { pick } from '../ui/pick';
import { ensureProfile } from '../ui/profile';
import { IValueRepository, showViewAndEditMenu } from '../ui/view-and-edit-menu';
import { makeResourceLoader } from './common/loader';

export async function showParameters(makeMRU: MRUFactoryFn, uiFactory: IUIFactory, settings: ISettings) {
  if (!(await ensureProfile(uiFactory.makeProfileUI(), settings))) return;

  try {
    const ui = uiFactory.makePickUI();
    await pick({
      ui,
      resourceType: 'parameter',
      region: 'ap-southeast-2',
      loadResources: getParameters,
      settings,
      mru: makeMRU('parameter'),
      onSelected: (parameter: Resource) => {
        const repository = new ParameterStoreValueRepository(parameter.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'parameter',
          resource: parameter,
          settings,
          uiFactory,
          valueRepository: repository,
        });
      },
      onUnmatched: async (text: string) => {
        const repository = new ParameterStoreValueRepository(undefined, 'ap-southeast-2');

        await createNameValuePair({
          kind: 'parameter',
          initialValue: text,
          uiFactory,
          valueRepository: repository,
        });

        return { finished: true };
      },
    });
  } catch (e) {
    assertIsErrorLike(e);
    await window.showErrorMessage(e.message);
  }
}

const getParameters = makeResourceLoader<ssm.SSMClient, ssm.Parameter>({
  init: ({ region }) => new ssm.SSMClient({ region }),

  async *enumerate(client) {
    let nextToken: string | undefined;
    do {
      const response = await client.send(new ssm.DescribeParametersCommand({ NextToken: nextToken }));
      yield* response.Parameters ?? [];
      nextToken = response.NextToken;
    } while (nextToken);
  },

  map(param: ssm.Parameter, region: string) {
    return {
      name: param.Name ?? 'Unknown',
      description: '',
      url: `https://${region}.console.aws.amazon.com/systems-manager/parameters${param.Name}/description?region=${region}&tab=Table`,
      arn: param.ARN,
    };
  },
});

class ParameterStoreValueRepository implements IValueRepository {
  private readonly client: ssm.SSMClient;

  constructor(private readonly id: string | undefined, readonly region: string) {
    this.client = new ssm.SSMClient({ region });
  }

  async createValue(_name: string, _value: string): Promise<void> {
    return;
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
