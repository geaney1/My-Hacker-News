import { Module } from '@nestjs/common';
import { AuthController } from './auth-controller';
import { CommentsController } from './comments-controller';
import { ProfileController } from './profile-controller';
import { StoriesController } from './stories-controller';
import { SubmissionsController } from './submissions-controller';
import { ThreadsController } from './threads-controller';
import { UpdatesController } from './updates-controller';
import { UsersController } from './users-controller';

/** The app's own API: every address that starts with `/api`. */
@Module({
  controllers: [
    AuthController,
    CommentsController,
    ProfileController,
    StoriesController,
    SubmissionsController,
    ThreadsController,
    UpdatesController,
    UsersController,
  ],
})
export class ApiModule {}
