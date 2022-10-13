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
  const name = (skipName ? initialName : await inputSSMName(initialName, uiFactory))?.trim();
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

export async function createSecret(params: CreateNameValuePairParams): Promise<{ finished: boolean }> {
  const { initialName, skipName, initialValue, uiFactory, valueRepository } = params;

  // Step 1: Name.
  const name = (skipName ? initialName : await inputSecretName(initialName, uiFactory))?.trim();
  if (name === undefined) {
    return { finished: false };
  }

  // Step 2: Value.
  const value = await inputValue(initialValue, name, uiFactory);
  if (value === undefined) {
    return createSSMParameter({ ...params, initialName: name, initialValue: value, skipName: false });
  }

  // Create parameter.
  const ui = uiFactory.makeBasicUI();
  await ui.withProgress('Creating new secret', async () => {
    try {
      return await valueRepository.createValue(name, value, NameValueSecrecy.secret);
    } catch (e) {
      assertIsErrorLike(e);
      await uiFactory.makeBasicUI().showMessage(MessageTypes.error, `Failed to create secret: ${e.message}`);
    }
  });

  return { finished: true };
}

async function inputSSMName(initialName: string | undefined, uiFactory: IUIFactory) {
  return await inputName({
    initialValue: initialName,
    target: 'parameter',
    uiFactory,
    validator: validateSSMParameterName,
  });

  function validateSSMParameterName(value: string): string | undefined {
    // Validate against the SSM Parameter Store rules, here:
    // https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-create.html

    const nameTrimmed = value.trim();

    // Blank?
    if (nameTrimmed === '') {
      return `Parameter name cannot be blank`;
    }

    // Invalid characters?
    if (/[^A-Z0-9_.\-/]/i.test(nameTrimmed)) {
      return `Parameter can only contain: A-Z a-z 0-9 _.-/`;
    }

    // Contains slash, but doesn't start with slash?
    if (nameTrimmed.includes('/') && !nameTrimmed.startsWith('/')) {
      return `Parameter name must start with / if it includes any /'s`;
    }

    // Ends with slash?
    if (nameTrimmed.endsWith('/')) {
      return `Parameter cannot end with /`;
    }

    // Contains too many hierarchy levels?
    const numSlashes = (nameTrimmed.match(/\//g) ?? []).length;
    if (numSlashes > 15) {
      return `Parameter name has too many hierarchy levels`;
    }

    // Contains empty hierarchy levels?
    if (/\/\//.test(nameTrimmed)) {
      return `Parameter name cannot have empty levels (//)`;
    }

    // Invalid prefix?
    let prefixMatch: RegExpMatchArray | null;
    // eslint-disable-next-line no-cond-assign
    if ((prefixMatch = nameTrimmed.match(/^\s*(\/?(?:aws|ssm))/i))) {
      return `Parameter name cannot start with ${prefixMatch[1]}`;
    }

    return;
  }
}

async function inputSecretName(initialName: string | undefined, uiFactory: IUIFactory) {
  return await inputName({
    initialValue: initialName,
    target: 'secret',
    uiFactory,
    validator: validateSecretName,
  });

  function validateSecretName(value: string): string | undefined {
    // Validate against the Secrets Manager rules, here:
    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_CreateSecret.html
    const nameTrimmed = value.trim();

    // Blank?
    if (nameTrimmed === '') {
      return `Secret name cannot be blank`;
    }

    // Invalid characters? /_+=.@-
    if (/[^A-Z0-9_.+=@\-/]/i.test(nameTrimmed)) {
      return `Secret can only contain: A-Z a-z 0-9 _.+=@-/`;
    }

    return;
  }
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
    validate: value => (value.trim() === '' ? `${target} value cannot be blank` : undefined),
  });
}

type InputNameParams = {
  initialValue: string | undefined;
  target: string;
  uiFactory: IUIFactory;
  validator?: (value: string) => string | undefined;
};
async function inputName({ initialValue, target, uiFactory, validator }: InputNameParams): Promise<string | undefined> {
  return await input({
    initialValue: initialValue ?? '',
    placeholder: `Enter name for ${target}`,
    title: `Create new ${target}`,
    step: { step: 1, totalSteps: 2 },
    uiFactory: uiFactory,
    validate: validator,
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
