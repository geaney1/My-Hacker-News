import type { Request, Response } from 'express';
import { bodyFields, requireJsonForPosts } from './http-helpers';

/** Just enough of an Express request and response for the helpers. */
function fakeRequest(method: string, contentType: string | false, body?: unknown) {
  // Like Express: `is('application/json')` gives the type when it matches, and false when it does not.
  return {
    method,
    body,
    is: (type: string) => (contentType === type ? type : false),
  } as unknown as Request;
}

function fakeResponse() {
  const response = { statusCode: 0, body: undefined as unknown };
  const asResponse = {
    status(code: number) {
      response.statusCode = code;
      return asResponse;
    },
    json(value: unknown) {
      response.body = value;
      return asResponse;
    },
  };
  return { response: asResponse as unknown as Response, sent: response };
}

describe('requireJsonForPosts', () => {
  it('lets a JSON POST through', () => {
    const next = vi.fn();
    const { response, sent } = fakeResponse();
    requireJsonForPosts(fakeRequest('POST', 'application/json'), response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(sent.statusCode).toBe(0);
  });

  it.each<string | false>([false, 'application/x-www-form-urlencoded'])(
    'refuses a POST that is not JSON (%s) with 415',
    (contentType) => {
      const next = vi.fn();
      const { response, sent } = fakeResponse();
      requireJsonForPosts(fakeRequest('POST', contentType), response, next);

      expect(next).not.toHaveBeenCalled();
      expect(sent.statusCode).toBe(415);
    },
  );

  it('refuses a PUT that is not JSON with 415, the same as a POST', () => {
    const next = vi.fn();
    const { response, sent } = fakeResponse();
    requireJsonForPosts(fakeRequest('PUT', 'application/x-www-form-urlencoded'), response, next);
    expect(next).not.toHaveBeenCalled();
    expect(sent.statusCode).toBe(415);
  });

  it.each(['GET', 'HEAD'])('does not look at the type of a %s request', (method) => {
    const next = vi.fn();
    const { response } = fakeResponse();
    requireJsonForPosts(fakeRequest(method, false), response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('bodyFields', () => {
  it('gives the fields of a JSON object', () => {
    expect(bodyFields(fakeRequest('POST', 'application/json', { a: 1 }))).toEqual({ a: 1 });
  });

  it.each([undefined, null, 'text', 42])('gives an empty object for the body %j', (body) => {
    expect(bodyFields(fakeRequest('POST', 'application/json', body))).toEqual({});
  });
});
