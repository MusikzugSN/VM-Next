import { ApiProblem } from '../api/api-problem';
import { fieldProblemHandler } from './field-problem-handler';

describe('fieldProblemHandler', () => {
  const setup = () => {
    const set = vi.fn();
    const focus = vi.fn();
    return { set, focus, handle: fieldProblemHandler({ set }, focus) };
  };

  it('shows validation errors at the fields and focuses the first one', () => {
    const { set, focus, handle } = setup();
    const problem = new ApiProblem(400, 'validation-failed', [{ path: '/body/name', code: 'too_small' }]);

    expect(handle(problem)).toBe(true);
    expect(set).toHaveBeenCalledWith({ name: 'too_small' });
    expect(focus).toHaveBeenCalledOnce();
  });

  it.each([new ApiProblem(409, 'name-taken'), new Error('boom'), undefined])('leaves other failures to the toast', (failure) => {
    const { set, focus, handle } = setup();

    expect(handle(failure)).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
});
