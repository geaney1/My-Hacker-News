import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApiAdapter } from './api-adapter';
import { ApiModule } from './api-module';

/** The app's API (see api-module.ts), ready to be served by itself or alongside the pages. */
export async function createApiApp(adapter = createApiAdapter()) {
  const apiApp = await NestFactory.create<NestFastifyApplication>(ApiModule, adapter, {
    // The adapter reads the request bodies (see api-adapter.ts).
    bodyParser: false,
    // Throw when starting fails, instead of ending the process (which may be the dev server).
    abortOnError: false,
    logger: ['error', 'warn'],
  });
  // For setting the session cookie.
  await apiApp.register(fastifyCookie);
  await apiApp.init();
  return apiApp;
}
