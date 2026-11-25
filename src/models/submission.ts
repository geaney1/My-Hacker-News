import type { SubmissionKind } from './submission-kind';

export type Submission = {
  id: string;
  /** The id the story has in the lists and at /item/<id>. */
  itemId: number;
  kind: SubmissionKind;
  username: string;
  title: string;
  url: string;
  text: string;
  submittedAt: number;
};
