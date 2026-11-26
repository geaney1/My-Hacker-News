import { HttpStatus } from '@nestjs/common';
import { BadRequestError } from './hn-fetch';
import { apiError, bodyFields, failureOf } from './http-helpers';

describe('bodyFields', () => {
  it('gives the fields of a JSON object', () => {
    expect(bodyFields({ a: 1 })).toEqual({ a: 1 });
  });

  it.each([undefined, null, 'text', 42])('gives an empty object for the body %j', (body) => {
    expect(bodyFields(body)).toEqual({});
  });
});

describe('apiError', () => {
  it('answers with the status, and only the message', () => {
    const error = apiError(HttpStatus.NOT_FOUND, 'Item not found');

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({ message: 'Item not found' });
  });
});

describe('failureOf', () => {
  const fallback = apiError(HttpStatus.BAD_GATEWAY, 'Could not load it');
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps an answer already made for the browser', () => {
    const answer = apiError(HttpStatus.UNAUTHORIZED, 'Not logged in');

    expect(failureOf(answer, 'Failed', fallback)).toBe(answer);
    expect(log).not.toHaveBeenCalled();
  });

  it('answers 400, saying why, for an invalid request', () => {
    const answer = failureOf(new BadRequestError('page must be a number'), 'Failed', fallback);

    expect(answer.getStatus()).toBe(400);
    expect(answer.getResponse()).toEqual({ message: 'page must be a number' });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs anything else, and answers with the fallback', () => {
    const error = new Error('disk full');

    expect(failureOf(error, 'Failed to load', fallback)).toBe(fallback);
    expect(log).toHaveBeenCalledWith('Failed to load', error);
  });
});
