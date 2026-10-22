import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

/** The project's GitHub repository. */
export const GITHUB_URL = "https://github.com/HalxDocs/reqit";

/** The author's portfolio site. */
export const PORTFOLIO_URL = "https://halxdocs.com";

/**
 * Open a link outside the app. Uses the native browser when the Wails runtime
 * is available and falls back to a normal window otherwise, which is what the
 * web build needs.
 */
export function openExternal(url: string) {
  try {
    BrowserOpenURL(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
