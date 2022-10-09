import { toSentenceCase } from '../tools/case';
import { assertIsErrorLike } from '../tools/error';
import { input } from './input';
import { IUIFactory, MessageTypes } from './interfaces';
import { IValueRepository, NameValueSecrecy } from './view-and-edit-menu';

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface ICreateUI {}

type CreateNameValuePairParams = {
  initialName?: string;
  skipName?: boolean;
  initialValue?: string;
  uiFactory: IUIFactory;
  valueRepository: IValueRepository;
};
export async function createSSMParameter(params: CreateNameValuePairParams): Promise<{ finished: boolean }> {
  const { initialName, skipName, initialValue, uiFactory, valueRepository } = params;

  // Step 1: Name.
  const name = skipName ? initialName : await inputName(initialName, 'parameter', uiFactory);
  if (name === undefined) {
    return { finished: false };
  }

  // Step 2: Value.
  const value = await inputValue(initialValue, name, uiFactory);
  if (value === undefined) {
    return createSSMParameter({ ...params, initialName: name, initialValue: value, skipName: false });
  }

  // Step 3: Type — Secret String vs String.
  const secrecy = await pickSecrecy(name, uiFactory);
  if (secrecy === undefined) {
    return createSSMParameter({ ...params, initialName: name, initialValue: value, skipName: true });
  }

  // Create parameter.
  const ui = uiFactory.makeBasicUI();
  await ui.withProgress('Creating new parameter', async () => {
    try {
      return await valueRepository.createValue(name, value, secrecy);
    } catch (e) {
      assertIsErrorLike(e);
      await uiFactory.makeBasicUI().showMessage(MessageTypes.error, `Failed to create parameter: ${e.message}`);
    }
  });

  return { finished: true };
}
async function inputValue(
  initialValue: string | undefined,
  target: string,
  uiFactory: IUIFactory,
): Promise<string | undefined> {
  return await input({
    initialValue: initialValue ?? '',
    placeholder: `Enter value for ${target}`,
    title: `Create new ${target}`,
    step: { step: 2, totalSteps: 2 },
    uiFactory: uiFactory,
    validate: value => (value.trim() === '' ? `${toSentenceCase(target)} value cannot be blank` : undefined),
  });
}

async function inputName(
  initialValue: string | undefined,
  target: string,
  uiFactory: IUIFactory,
): Promise<string | undefined> {
  return await input({
    initialValue: initialValue ?? '',
    placeholder: `Enter name for ${target}`,
    title: `Create new ${target}`,
    step: { step: 1, totalSteps: 2 },
    uiFactory: uiFactory,
    validate: value => (value.trim() === '' ? `${toSentenceCase(target)} name cannot be blank` : undefined),
  });
}

const SECRET_STRING = 'Secret string';
const PLAIN_STRING = 'Plain string';
async function pickSecrecy(name: string, uiFactory: IUIFactory): Promise<NameValueSecrecy | undefined> {
  const type = await uiFactory
    .makeBasicUI()
    .pickString([SECRET_STRING, PLAIN_STRING], `Choose type for ${name}`, 'Create new parameter (3/3)');
  switch (type) {
    case SECRET_STRING:
      return NameValueSecrecy.secret;
    case PLAIN_STRING:
      return NameValueSecrecy.notSecret;
    default:
      return undefined;
  }
}
