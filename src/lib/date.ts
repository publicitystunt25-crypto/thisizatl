const TIME_ZONE = "America/New_York";

// The server (Render) runs in UTC, so any date formatting that relies on the
// runtime's local timezone silently shows UTC instead of Eastern time. Every
// display of a post's date/time on the site should go through these helpers
// instead of calling toLocaleString/toLocaleDateString directly.

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Builds the value for an <input type="datetime-local"> so the admin form
// shows/edits a post's Published Date in Eastern time, not the server's UTC.
export function toEasternDatetimeLocalValue(iso?: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// The reverse: a "YYYY-MM-DDTHH:mm" value from a datetime-local input,
// interpreted as Eastern time, converted to a real UTC ISO string for
// storage. Uses the timezone offset trick since JS has no native way to
// parse a wall-clock time in an arbitrary IANA zone.
export function fromEasternDatetimeLocalValue(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Find the UTC offset Eastern time is currently observing (handles DST)
  // by formatting a guess and reading back the offset, then correcting.
  const asUTCGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const easternString = asUTCGuess.toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [datePart2, timePart2] = easternString.split(", ");
  const [m2, d2, y2] = datePart2.split("/").map(Number);
  const [h2, min2] = timePart2.split(":").map(Number);
  const asEasternInterpretedAsUTC = Date.UTC(y2, m2 - 1, d2, h2, min2);
  const offsetMs = asEasternInterpretedAsUTC - asUTCGuess.getTime();

  return new Date(asUTCGuess.getTime() - offsetMs).toISOString();
}
