/**
 * GOOGLE CLOUD OAUTH 2.0 WEB CLIENT ID CONFIGURATION
 * 
 * To connect Google Drive across all devices and browsers without entering
 * the Client ID manually on each device:
 * 
 * METHOD 1 (Recommended via .env file):
 * Set VITE_GOOGLE_CLIENT_ID in your root `.env` file:
 *   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
 * 
 * METHOD 2 (Directly here in code):
 * Paste your Google OAuth 2.0 Web Client ID into DEFAULT_GOOGLE_CLIENT_ID below.
 * Example:
 *   export const DEFAULT_GOOGLE_CLIENT_ID = '1234567890-abcdefg.apps.googleusercontent.com';
 */
export const DEFAULT_GOOGLE_CLIENT_ID: string = '';
