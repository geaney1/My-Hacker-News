import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HnComment } from '../../../models/hn-comment';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';

/** One comment and, nested beneath it, its replies. Each comment can be collapsed. */
@Component({
  selector: 'app-story-comment',
  imports: [RouterLink, TimeAgoPipe],
  templateUrl: './story-comment.html',
  styleUrl: './story-comment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryComment {
  readonly comment = input.required<HnComment>();
}
