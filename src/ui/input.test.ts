import { when } from 'ts-mockito';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeInputBox } from '../__test__/fakes';
import { CommonDependencies, setupCommonDependencies } from '../__test__/setups';
import { input } from './input';

describe('input', () => {
  const deps: CommonDependencies = setupCommonDependencies('ASG');
  let inputBox: FakeInputBox;

  beforeEach(async () => {
    // Reset.
    deps.reset();

    // UI: createQuickPick() --> picker
    inputBox = new FakeInputBox();
    when(deps.mockUIFactory.makeInputUI()).thenReturn({
      createInputBox: () => inputBox,
    });
  });

  it('respects step arguments', async () => {
    void input({
      step: { step: 3, totalSteps: 7 },
      uiFactory: deps.uiFactory,
    });

    expect(inputBox.step).toBe(3);
    expect(inputBox.totalSteps).toBe(7);
  });

  it('validates on input', async () => {
    void input({
      uiFactory: deps.uiFactory,
      validate: (value: string) => (value === 'invalid' ? 'ERROR' : ''),
    });

    inputBox.typeText('invalid');
    expect(inputBox.validationMessage).toBe('ERROR');
  });

  it('accepts a title', async () => {
    void input({
      title: 'Hello world',
      uiFactory: deps.uiFactory,
      validate: (value: string) => (value === 'invalid' ? 'ERROR' : ''),
    });

    inputBox.typeText('invalid');
    expect(inputBox.title).toBe('Hello world');
  });
});
