// sanitizeError strips internal details from error messages before showing them
// to the user (e.g. "wails", "localhost", internal file paths).
export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);

  // Replace common internal details with user-safe alternatives
  msg = msg.replace(/wails|localhost|127\.0\.0\.1/g, "app");
  msg = msg.replace(/internal\/[a-z_/]+/g, "internal error");
  msg = msg.replace(/\/[a-z_/]+\/[a-z_]+\.go:\d+/gi, "");
  msg = msg.replace(/"failed to (create|save|read|write|open).*?"/gi, "file operation failed");
  msg = msg.replace(/context canceled/i, "request was cancelled");
  msg = msg.replace(/context deadline exceeded/i, "request timed out");

  return msg;
}
