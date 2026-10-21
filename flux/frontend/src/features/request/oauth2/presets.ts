// Well-known OAuth 2.0 provider presets, so a user can set up GitHub, Google,
// Entra ID and friends without pasting endpoint URLs.

export type GrantType = "auth_code" | "device" | "client_credentials" | "password" | "implicit";

export interface Preset {
  key: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  deviceUrl: string;
  scopes: string;
}

export const PRESETS: Preset[] = [
  { key: "github", label: "GitHub", authUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", deviceUrl: "https://github.com/login/device/code", scopes: "repo user gist" },
  { key: "google", label: "Google", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", deviceUrl: "https://oauth2.googleapis.com/device/code", scopes: "openid email profile" },
  { key: "spotify", label: "Spotify", authUrl: "https://accounts.spotify.com/authorize", tokenUrl: "https://accounts.spotify.com/api/token", deviceUrl: "", scopes: "user-read-email" },
  { key: "slack", label: "Slack", authUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", deviceUrl: "", scopes: "chat:write" },
  { key: "gitlab", label: "GitLab", authUrl: "https://gitlab.com/oauth/authorize", tokenUrl: "https://gitlab.com/oauth/token", deviceUrl: "https://gitlab.com/oauth/device/code", scopes: "api read_user" },
  { key: "entra", label: "Entra ID", authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", deviceUrl: "", scopes: "openid profile email offline_access User.Read" },
  { key: "auth0", label: "Auth0", authUrl: "https://YOUR_TENANT.auth0.com/authorize", tokenUrl: "https://YOUR_TENANT.auth0.com/oauth/token", deviceUrl: "https://YOUR_TENANT.auth0.com/oauth/device/code", scopes: "openid profile email" },
  { key: "okta", label: "Okta", authUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/authorize", tokenUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/token", deviceUrl: "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/device/authorize", scopes: "openid profile email" },
  { key: "keycloak", label: "Keycloak", authUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/auth", tokenUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/token", deviceUrl: "http://localhost:8080/realms/reqit-test/protocol/openid-connect/auth/device", scopes: "openid profile" },
  { key: "custom", label: "Custom", authUrl: "", tokenUrl: "", deviceUrl: "", scopes: "" },
];
