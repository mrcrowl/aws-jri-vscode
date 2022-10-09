import { instance, mock, reset, when } from 'ts-mockito';
import { beforeEach, describe, expect, it } from 'vitest';
import { sleep } from '../tools/async';
import { FakeInputBox } from '../__test__/fakes';
import { CommonDependencies, setupCommonDependencies } from '../__test__/setups';
import { createNameValuePair } from './create';
import { IInputUI } from './input';
import { IValueRepository } from './view-and-edit-menu';

describe('create', () => {
  const deps: CommonDependencies = setupCommonDependencies('ASG');
  const mockRepository = mock<IValueRepository>();
  let inputBox: FakeInputBox;

  beforeEach(async () => {
    // Reset.
    deps.reset();
    reset(mockRepository);

    inputBox = new FakeInputBox();
    const inputUI: IInputUI = {
      createInputBox: () => inputBox,
    };
    when(deps.mockUIFactory.makeInputUI()).thenReturn(inputUI);
  });

  it('shows step 1/2 with empty initial value', async () => {
    void createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });

    expect(inputBox.placeholder).toBe('Enter parameter name');
    expect(inputBox.step).toBe(1);
    expect(inputBox.totalSteps).toBe(2);
    expect(inputBox.value).toBe('');
    expect(inputBox.title).toBe('Create new parameter');
    expect(inputBox.ignoreFocusOut).toBe(true);
  });

  it('defaults to provided text', async () => {
    void createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      initialValue: 'hello/world',
      valueRepository: instance(mockRepository),
    });
    expect(inputBox.value).toBe('hello/world');

    inputBox.typeText('goodbye');
    expect(inputBox.value).toBe('goodbye');
  });

  it('shows validation message if name is blank', async () => {
    void createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });
    inputBox.typeText('   ');
    expect(inputBox.validationMessage).toMatch(/cannot be blank/);
    inputBox.typeText('abcd');
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it('shows step 2 when valid name is entered', async () => {
    void createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });
    inputBox.typeText('/param/name');
    inputBox.fireDidAccept();
    await sleep(0);
    expect(inputBox.value).toBe('');
    expect(inputBox.step).toBe(2);
  });

  it('reverts to step 1 when step 2 is cancelled', async () => {
    void createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });
    inputBox.typeText('/param/name');
    inputBox.fireDidAccept();
    await sleep(0);
    expect(inputBox.value).toBe('');
    expect(inputBox.step).toBe(2);
    inputBox.fireDidHide();
    await sleep(0);
    expect(inputBox.step).toBe(1);
  });

  it('resolves with finished: true if both steps are completed', async () => {
    const vp = createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });
    expect(inputBox.step).toBe(1);
    inputBox.typeText('/param/name');
    inputBox.fireDidAccept();
    await sleep(0);
    expect(inputBox.step).toBe(2);
    inputBox.typeText('some_value_goes_here');
    inputBox.fireDidAccept();
    inputBox.fireDidHide();
    await sleep(0);
    expect(await vp).toEqual({ finished: true });
  });

  it('resolves with finished: false if step 1 is cancelled', async () => {
    const vp = createNameValuePair({
      kind: 'parameter',
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockRepository),
    });
    await sleep(0);
    inputBox.fireDidHide();
    await sleep(0);
    expect(await vp).toEqual({ finished: false });
  });
});
