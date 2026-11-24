import { Routes } from '@angular/router';
import { loggedInGuard, submitListGuard } from './core/auth/auth.guards';
import { storyListMatcher } from './features/stories/story-list.matcher';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((module) => module.Dashboard),
    // Every page lives inside the dashboard, so the side menu and header are always there.
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'top' },
      {
        path: 'log-in',
        title: 'Log in',
        loadComponent: () => import('./features/auth/log-in/log-in').then((module) => module.LogIn),
      },
      {
        path: 'create-user',
        title: 'Create a new user',
        loadComponent: () =>
          import('./features/auth/create-user/create-user').then((module) => module.CreateUser),
      },
      {
        path: 'welcome',
        title: 'Welcome',
        canActivate: [loggedInGuard],
        loadComponent: () => import('./features/welcome/welcome').then((module) => module.Welcome),
      },
      {
        path: 'item/:id',
        title: 'Story',
        loadComponent: () =>
          import('./features/item/item-page/item-page').then((module) => module.ItemPage),
      },
      {
        path: 'user/:id',
        title: 'User',
        loadComponent: () =>
          import('./features/user/user-page/user-page').then((module) => module.UserPage),
      },
      {
        path: 'user-profile',
        title: 'Profile',
        canActivate: [loggedInGuard],
        loadComponent: () =>
          import('./features/user-profile/user-profile').then((module) => module.UserProfile),
      },
      {
        path: 'change-password',
        title: 'Change password',
        canActivate: [loggedInGuard],
        loadComponent: () =>
          import('./features/change-password/change-password').then(
            (module) => module.ChangePassword,
          ),
      },
      {
        // Matches /top, /new, /best, /ask, /show, /job and /submit
        matcher: storyListMatcher,
        title: 'Hacker News',
        canActivate: [submitListGuard],
        loadComponent: () =>
          import('./features/stories/stories-page/stories-page').then(
            (module) => module.StoriesPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
