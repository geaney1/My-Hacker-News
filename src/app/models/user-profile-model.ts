type YesNo = 'yes' | 'no';

export type UserProfileModel = {
  about: string;
  email: string;
  showdead: YesNo;
  noprocrast: YesNo;
  maxvisit: number;
  minaway: number;
  delay: number;
};
