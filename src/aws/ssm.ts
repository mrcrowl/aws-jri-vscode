import * as ssm from '@aws-sdk/client-ssm';
import { window } from 'vscode';
import { assertIsErrorLike } from '../error';
import { MRUFactoryFn } from '../mru';
import { ISettings, pick } from '../pick';
import { ensureProfile } from '../profile';
import { Resource } from '../resource';
import { IValueRepository, showViewAndEditMenu } from '../view-and-edit-menu';
import { makeResourceLoader } from './common/loader';

export async function showParameters(makeMRU: MRUFactoryFn, settings: ISettings) {
  if (!(await ensureProfile(settings))) return;

  try {
    await pick({
      resourceType: 'parameter',
      region: 'ap-southeast-2',
      loadResources: getParameters,
      settings,
      mru: makeMRU('parameter'),
      onSelected: (parameter: Resource) => {
        const readerWriter = new ParameterStoreValueRepository(parameter.name, 'ap-southeast-2');

        return showViewAndEditMenu({
          kind: 'parameter',
          resource: parameter,
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
