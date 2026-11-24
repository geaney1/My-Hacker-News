import { Pipe, PipeTransform } from '@angular/core';

const units = [
  { name: 'y', seconds: 31_536_000 },
  { name: 'mo', seconds: 2_592_000 },
  { name: 'd', seconds: 86_400 },
  { name: 'h', seconds: 3_600 },
  { name: 'm', seconds: 60 },
] as const;

/** Formats a Unix timestamp in seconds as a short relative time such as "2h ago". */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(unixSeconds: number | undefined): string {
    if (!unixSeconds) {
      return '';
    }
    const elapsedSeconds = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
    const unit = units.find((candidate) => elapsedSeconds >= candidate.seconds);
    return unit ? `${Math.floor(elapsedSeconds / unit.seconds)}${unit.name} ago` : 'just now';
  }
}
