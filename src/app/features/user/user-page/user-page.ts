import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HnApi } from '../../../core/api/hn-api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ResponseStatus } from '../../../core/response-status';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';

/** The public Hacker News profile of any user, opened from an author name. */
@Component({
  selector: 'app-user-page',
  imports: [RouterLink, TimeAgoPipe],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPage {
  private readonly hnApi = inject(HnApi);
  private readonly location = inject(Location);
  private readonly responseStatus = inject(ResponseStatus);
  private readonly authStore = inject(AuthStore);

  /** The username from the URL (`/user/:id`), bound from the route parameter. */
  readonly id = input.required<string>();

  protected readonly initial = computed(() => this.id().charAt(0));

  /** `true` when the signed-in user is looking at their own profile. */
  protected readonly isOwnProfile = computed(
    () => this.authStore.login() && this.authStore.username() === this.id(),
  );

  protected readonly user = resource({
    params: () => this.id(),
    loader: ({ params }) => this.hnApi.getUser(params),
  });

  constructor() {
    // A user that does not exist is a 404, not a successful page.
    effect(() => {
      if (this.user.value() === null) {
        this.responseStatus.setNotFound();
      }
    });
  }

  protected goBack() {
    this.location.back();
  }
}
