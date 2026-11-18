import { loginErrorKey } from './login-page';

describe('loginErrorKey', () => {
  it('maps callback errors, API problem codes and unknown values', () => {
    expect(loginErrorKey(undefined)).toBeNull();
    expect(loginErrorKey('state-mismatch')).toBe('errors.login.state-mismatch');
    expect(loginErrorKey('network-error')).toBe('errors.network-error');
    expect(loginErrorKey('internal-error')).toBe('errors.internal-error');
    expect(loginErrorKey('<script>')).toBe('errors.unknown');
  });
});
