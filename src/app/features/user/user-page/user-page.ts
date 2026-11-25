import { Location } from '@angular/common';
import { Component, computed, effect, inject, input, resource } from '@angular/core';
import { HnApi } from '../../../core/api/hn-api';
import { ResponseStatus } from '../../../core/response-status';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';
import { Banner } from '../../../shared/banner/banner';

/** The public Hacker News profile of any user, opened from an author name. */
@Component({
  selector: 'app-user-page',
  imports: [Banner, TimeAgoPipe],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage {
  private readonly hnApi = inject(HnApi);
  private readonly location = inject(Location);
  private readonly responseStatus = inject(ResponseStatus);

  /** The username from the URL (`/user/:id`), bound from the route parameter. */
  readonly id = input.required<string>();

  protected readonly initial = computed(() => this.id().charAt(0));

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
