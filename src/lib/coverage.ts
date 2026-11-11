// Choices on the public "Request Coverage" form (/pitch). Kept out of the
// "use server" action file so the client form and the server action can both
// import them.
export const REQUESTER_ROLES = [
  "Artist",
  "Publicist / PR",
  "Manager or label",
  "Brand or business",
  "Event organizer",
  "Other",
] as const;

// Effectively unlimited for a pitch or pasted press release (~8,000 words); the
// cap only exists so a bot or a mistake can't push megabytes of text into the
// database and the newsroom email.
export const MAX_PITCH_DETAILS_CHARS = 50_000;

// Photos on the form: kept under the server's 75MB request limit and 512MB of
// RAM (they're processed one at a time on the server).
export const MAX_PITCH_PHOTOS = 5;
export const MAX_PITCH_PHOTO_BYTES = 65 * 1024 * 1024;

export const REQUEST_TYPES = [
  "Website feature",
  "Artist spotlight",
  "Premiere / new release",
  "Event coverage",
  "Other",
] as const;

// Extra Instagram pages a requester can ask us to collaborate with on the post.
export const MAX_PITCH_COLLABS = 3;
