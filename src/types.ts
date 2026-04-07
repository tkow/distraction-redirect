export type BlockedDomain = {
  hostname: string; // plain hostname OR regex pattern string
  isRegex?: boolean;
  addedAt: number;
};

export type Message =
  | { type: 'ADD_DOMAIN'; hostname: string; isRegex?: boolean }
  | { type: 'REMOVE_DOMAIN'; hostname: string }
  | { type: 'VALIDATE_DOMAIN'; hostname: string };

export type MessageResponse =
  | { success: true; domains?: BlockedDomain[] }
  | { success: false; error: string };
