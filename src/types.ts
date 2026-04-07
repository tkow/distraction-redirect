export type BlockedDomain = {
  hostname: string; // plain hostname or wildcard pattern, e.g. *.social or twitter.*
  addedAt: number;
};

export type Message =
  | { type: 'ADD_DOMAIN'; hostname: string }
  | { type: 'REMOVE_DOMAIN'; hostname: string }
  | { type: 'VALIDATE_DOMAIN'; hostname: string }
  | { type: 'SYNC_DOMAINS'; hostnames: string[] };

export type MessageResponse =
  | { success: true; domains?: BlockedDomain[] }
  | { success: false; error: string };
