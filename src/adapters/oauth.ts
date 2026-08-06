/**
 * Reusable OAuth framework. Adding a provider = one entry in this table.
 * Client secrets and refresh tokens stay server-side.
 */

export interface OAuthProviderConfig {
  providerId: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  /** Extra authorize params (offline access, consent prompts…). */
  extraParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    providerId: "google-drive",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    scopes: ["https://www.googleapis.com/auth/drive", "openid", "email"],
    extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  {
    providerId: "onedrive",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    scopes: ["Files.ReadWrite.All", "offline_access", "User.Read"],
  },
  {
    providerId: "dropbox",
    authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    clientIdEnv: "DROPBOX_CLIENT_ID",
    clientSecretEnv: "DROPBOX_CLIENT_SECRET",
    scopes: ["files.content.write", "files.content.read", "account_info.read"],
  },
];

export function oauthConfig(providerId: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS.find((entry) => entry.providerId === providerId);
}
