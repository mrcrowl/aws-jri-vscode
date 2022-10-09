import { beforeEach, describe, it } from 'vitest';
import { CommonDependencies, setupCommonDependencies } from '../__test__/setups';
import { showParameters } from './ssm';

describe('showParameters', () => {
  let deps: CommonDependencies;

  beforeEach(() => {
    deps = setupCommonDependencies('parameter');
  });

  it('does stuff', async () => {
    await showParameters(deps.makeMruFn, deps.uiFactory, deps.settings);
  });
});
