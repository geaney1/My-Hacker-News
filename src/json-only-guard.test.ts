import type { ExecutionContext } from '@nestjs/common';
import { JsonOnlyGuard } from './json-only-guard';

/** Just enough of a Nest context, holding a request, for the guard. */
function contextFor(method: string, contentType: string | undefined) {
  const request = { method, headers: { 'content-type': contentType } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JsonOnlyGuard', () => {
  const guard = new JsonOnlyGuard();

  it.each(['POST', 'PUT'])('lets a JSON %s through', (method) => {
    expect(guard.canActivate(contextFor(method, 'application/json'))).toBe(true);
  });

  it.each(['application/json; charset=utf-8', 'Application/JSON'])(
    'knows %s is JSON',
    (contentType) => {
      expect(guard.canActivate(contextFor('POST', contentType))).toBe(true);
    },
  );

  it.each<[string, string | undefined]>([
    ['POST', undefined],
    ['POST', 'text/plain'],
    ['POST', 'application/jsonp'],
    ['POST', 'application/x-www-form-urlencoded'],
    ['PUT', 'application/x-www-form-urlencoded'],
  ])('refuses a %s of type %s with 415', (method, contentType) => {
    expect(() => guard.canActivate(contextFor(method, contentType))).toThrow(
      expect.objectContaining({ status: 415 }),
    );
  });

  it.each(['GET', 'HEAD'])('does not look at the type of a %s request', (method) => {
    expect(guard.canActivate(contextFor(method, undefined))).toBe(true);
  });
});
