# Google Drive backups — LNReader Desktop

The LNReader Desktop app offers **Settings → Backups → Google Drive**. The end user **never enters a Google API key or OAuth client ID**. They click **Connect Google account**, authorize the LNReader app through their normal browser, and can create, list, and restore compatible LNReader ZIP backups from a visible folder named **LNReader Backups**.

## One-time configuration by the project owner

1. Open https://console.cloud.google.com/ and create/select a Google Cloud project.
2. In Google Cloud, enable the **Google Drive API**.
3. Set up Google Auth Platform / OAuth consent screen for the application. Add test users while in Testing mode. For general distribution, publish the app and complete any verification the Google console requests.
4. Under **Clients**, create an **OAuth 2.0 client ID** with application type **Desktop app**, and copy its **client ID** (e.g. 123456789-abcdef.apps.googleusercontent.com). Do not use an API key, Web application client or service account.
5. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Set the name to **LNREADER_GOOGLE_CLIENT_ID** and the value to the Desktop OAuth client ID. The variable is inserted at compile time into the desktop build. The developer configures it once; no user enters it.
6. To compile locally: on PowerShell set the process environment variable LNREADER_GOOGLE_CLIENT_ID and run npm run dist:win in desktop; on Linux set that environment variable while running npm run dist:linux.

The desktop client ID is a **public application identifier**, not a confidential key. **Never commit or embed client secrets, user refresh tokens, passwords or service account credentials.** When a build has no valid client ID, the app shows an informative disabled Drive settings page; local backups remain available.

## Implementation and security

- Desktop OAuth 2.0 uses the default system browser, loopback 127.0.0.1 on a random local port, PKCE S256 and CSRF state validation. The requested scope is restricted to Google Drive's drive.file permission.
- Google OAuth refresh tokens are encrypted using Electron safeStorage in a file separate from the library. If the Linux password store reports basic_text or secure encryption is not available, sign-in is blocked instead of storing the token in plaintext.
- Backup files are generated through the existing LNReader backup worker and are uploaded using a Google Drive resumable upload session with a streamed ZIP. No change is made to ZIP compatibility.
- The app only lists and downloads backups from its own LNReader Backups folder in Google Drive. The **Restore latest backup** button uses the newest Drive creation timestamp rather than trusting the API response order. The **Choose another backup** button opens an explicit radio selection: restore stays disabled until a version is picked. The same existing confirmation still applies to either choice. Download size is limited to 512 MiB and integrity is verified via Google file metadata (including MD5 when available). Downloads are validated by the existing LNReader backup parser.
- Restoring asks for confirmation and saves the previous local library state, exactly as the existing local restore flow does.
- Daily automatic backup is opt-in. It runs only while the app is open and connected; no separate OS background service is installed. It is delayed at least 24 hours after the previous successful upload.
- Backups are not automatically deleted; they use the user's own Google Drive storage quota. Account revocation is controlled by the user's Google account settings.

## Testing

Run npm test inside desktop for network-free tests of the PKCE flow, token encryption, simulated Drive listing/upload/download, invalid IDs and automatic-backup scheduling. GitHub Actions also opens the new settings page in Electron on both Windows and Linux without connecting to a real Google account.

A real Google Cloud project, OAuth consent authorization and manual end-to-end Drive upload/restore must still be tested before public release. Synthetic tests cannot guarantee that Google's live sign-in and quotas are configured correctly.

Official documentation:
- https://developers.google.com/identity/protocols/oauth2/native-app
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/manage-uploads

The secure token vault checks the **initialized** Linux keyring backend and refuses missing or plaintext providers; a change from a working backend to `basic_text` must not allow access to saved refresh tokens.

If Google invalidates a cached access token early, the app refreshes it and retries **one read request**. Write/upload operations are not automatically repeated after an HTTP 401 so that a consumed stream or mutation cannot be replayed unexpectedly; users can retry manually after the refreshed login state.
