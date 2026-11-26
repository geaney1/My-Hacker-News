import { HttpException, HttpStatus } from '@nestjs/common';
import { BadRequestError } from './hn-fetch';

/** The fields of a JSON request body, or an empty object when there is no usable body. */
export function bodyFields(body: unknown) {
  return (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
}

/** An error answer for the browser: the status, and a message in JSON. */
export function apiError(status: HttpStatus, message: string) {
  return new HttpException({ message }, status);
}

/**
 * The error to answer with when a route fails. An answer already made for the browser is kept,
 * and an invalid request gets a 400 saying why. Anything else is logged, and the browser only
 * gets the `fallback` answer, which says nothing about what went wrong inside.
 */
export function failureOf(error: unknown, logMessage: string, fallback: HttpException) {
  if (error instanceof HttpException) {
    return error;
  }
  if (error instanceof BadRequestError) {
    return apiError(HttpStatus.BAD_REQUEST, error.message);
  }
  console.error(logMessage, error);
  return fallback;
}
