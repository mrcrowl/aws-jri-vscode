import { toSentenceCase } from '../tools/case';
import { assertIsErrorLike } from '../tools/error';
import { input } from './input';
import { IUIFactory } from './interfaces';
import { IValueRepository } from './view-and-edit-menu';

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface ICreateUI {}

type CreateNameValuePairParams = {
  initialValue?: string; //
  uiFactory: IUIFactory;
  kind: 'secret' | 'parameter';
  valueRepository: IValueRepository;
};
export async function createNameValuePair(params: CreateNameValuePairParams): Promise<{ finished: boolean }> {
  const { initialValue, kind, uiFactory, valueRepository } = params;

  // Step 1: Name.
  const name = await input({
    initialValue: initialValue ?? '',
    placeholder: `Enter name for ${kind}`,
    title: `Create new ${kind}`,
    step: { step: 1, totalSteps: 2 },
    uiFactory: uiFactory,
    validate: value => (value.trim() === '' ? `${toSentenceCase(kind)} name cannot be blank` : undefined),
  });
  if (name === undefined) return { finished: false };

  // Step 2: Value.
  const value = await input({
    initialValue: '',
    placeholder: `Enter value for ${kind}`,
    title: `Create new ${kind}`,
    step: { step: 2, totalSteps: 2 },
    uiFactory: uiFactory,
    validate: value => (value.trim() === '' ? `${toSentenceCase(kind)} value cannot be blank` : undefined),
  });
  if (value === undefined) return createNameValuePair({ ...params, initialValue: name });

  try {
    await valueRepository.createValue(name, value);
  } catch (e) {
    assertIsErrorLike(e);
    await uiFactory.makePickUI().showErrorMessage(`Failed to create ${kind}: ${e.message}`);
    return { finished: false };
  }

  return { finished: true };
}
