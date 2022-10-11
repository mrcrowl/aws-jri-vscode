import { anything, capture, instance, mock, reset, when } from 'ts-mockito';
import { beforeEach, describe, expect, it } from 'vitest';
import { sleep } from '../tools/async';
import { FakeInputBox } from '../__test__/fakes';
import { CommonDependencies, setupCommonDependencies } from '../__test__/setups';
import { createSSMParameter } from './create';
import { IInputUI } from './input';
import { IBasicUI } from './interfaces';
import { IValueRepository, NameValueSecrecy } from './view-and-edit-menu';

const GOOD_NAME = 'abcd';

describe('createSSMParameter', () => {
  const deps: CommonDependencies = setupCommonDependencies('ASG');
  const mockValueRepository = mock<IValueRepository>();
  const mockBasicUI = mock<IBasicUI>();
  let inputBox: FakeInputBox;

  beforeEach(async () => {
    // Reset.
    deps.reset();
    reset(mockValueRepository);

    inputBox = new FakeInputBox();
    const inputUI: IInputUI = {
      createInputBox: () => inputBox,
    };
    when(deps.mockUIFactory.makeInputUI()).thenReturn(inputUI);
    when(deps.mockUIFactory.makeBasicUI()).thenReturn(instance(mockBasicUI));
  });

  it('automatically trims whitespace from the name (but not value)', async () => {
    when(mockBasicUI.pickString(anything(), anything(), anything())).thenResolve('Secret string');
    when(mockBasicUI.withProgress(anything(), anything())).thenCall((_: string, action: () => any) => {
      action();
    });

    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('\t\n some-name\t ');
    expect(inputBox.validationMessage).toBeUndefined();
    inputBox.fireDidAccept();
    await sleep(0);

    inputBox.typeText(' some-value ');
    inputBox.fireDidAccept();
    await sleep(0);

    const [name, value, secrecy] = capture(mockValueRepository.createValue).first();
    expect(name).toBe('some-name');
    expect(value).toBe(' some-value ');
    expect(secrecy).toBe(NameValueSecrecy.secret);
  });

  it('shows step 1/2 with empty initial value', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });

    expect(inputBox.placeholder).toBe('Enter name for parameter');
    expect(inputBox.step).toBe(1);
    expect(inputBox.totalSteps).toBe(2);
    expect(inputBox.value).toBe('');
    expect(inputBox.title).toBe('Create new parameter');
    expect(inputBox.ignoreFocusOut).toBe(true);
  });

  it('defaults to provided text', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      initialName: 'hello/world',
      valueRepository: instance(mockValueRepository),
    });
    expect(inputBox.value).toBe('hello/world');

    inputBox.typeText('goodbye');
    expect(inputBox.value).toBe('goodbye');
  });

  it('shows validation message if name is blank', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('   ');
    expect(inputBox.validationMessage).toMatch(/cannot be blank/);
    inputBox.typeText(GOOD_NAME);
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it.each([
    { char: '😜', example: '/hello/😜' },
    { char: '$', example: '/hello/$' },
    { char: '@', example: '/hello/@' },
    { char: 'ش', example: '/hello/ش' },
    // { char: '', example: 'hello/' },
  ])('shows validation message if name contains $char', async ({ example }) => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText(example);
    expect(inputBox.validationMessage).toMatch(/can only contain: a-zA-Z0-9_.-/);
    inputBox.typeText(GOOD_NAME);
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it("shows validation message if name contains / but doesn't start with /", async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('a/b');
    expect(inputBox.validationMessage).toMatch(`must start with /`);
    inputBox.typeText('/a/b');
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it.each(['aws', 'AWS', '/aws', 'ssm', 'ssm', '/ssm'])(
    'shows validation message if name starts with invalid prefixes (%s)',
    async prefix => {
      void createSSMParameter({
        uiFactory: deps.uiFactory,
        valueRepository: instance(mockValueRepository),
      });
      inputBox.typeText(prefix);
      expect(inputBox.validationMessage).toMatch(`cannot start with ${prefix}`);
      inputBox.typeText(GOOD_NAME);
      expect(inputBox.validationMessage).toBeUndefined();
    },
  );

  it('shows validation message if name has too many hierarchy levels', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p');
    expect(inputBox.validationMessage).toMatch(`has too many hierarchy levels`);
    inputBox.typeText('/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o');
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it('shows validation message if name has empty hierarchy levels', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('/a//b');
    expect(inputBox.validationMessage).toMatch(`cannot have empty levels (//)`);
    inputBox.typeText('/a/b/c');
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it("shows validation message if name contains / but doesn't start with /", async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('abc/def');
    expect(inputBox.validationMessage).toMatch(/must start with \//);
    inputBox.typeText(GOOD_NAME);
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it('shows validation message if name ends with a slash', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('/abc/def/');
    expect(inputBox.validationMessage).toMatch(/cannot end with \//);
    inputBox.typeText(GOOD_NAME);
    expect(inputBox.validationMessage).toBeUndefined();
  });

  it('shows step 2 when valid name is entered', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    inputBox.typeText('/param/name');
    inputBox.fireDidAccept();
    await sleep(0);
    expect(inputBox.value).toBe('');
    expect(inputBox.step).toBe(2);
  });

  it('reverts to step 1 when step 2 is cancelled', async () => {
    void createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
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
    const vp = createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
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
    const vp = createSSMParameter({
      uiFactory: deps.uiFactory,
      valueRepository: instance(mockValueRepository),
    });
    await sleep(0);
    inputBox.fireDidHide();
    await sleep(0);
    expect(await vp).toEqual({ finished: false });
  });
});
