import { google } from 'googleapis';
import {
  getGoogleOAuthClientConfig,
  getGoogleTokens,
  saveGoogleTokens,
  clearGoogleTokens,
} from '@/lib/db/app-db';
import type { GoogleAccountStatus } from '@/types';

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'openid', 'email'];

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function buildAuthUrl(redirectUri: string): string {
  const cfg = getGoogleOAuthClientConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Set up your Google OAuth client ID and secret first.');
  }
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
  const cfg = getGoogleOAuthClientConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Set up your Google OAuth client ID and secret first.');
  }
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);
  const email = decodeEmailFromIdToken(tokens.id_token);
  saveGoogleTokens({
    accessToken: tokens.access_token || '',
    refreshToken: tokens.refresh_token || '',
    expiryDate: tokens.expiry_date || 0,
    email,
  });
}

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const cfg = getGoogleOAuthClientConfig();
  const tokens = getGoogleTokens();
  if (!cfg.clientId || !cfg.clientSecret || !tokens.refreshToken) {
    throw new Error('Connect your Google account in Settings first.');
  }
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret);
  client.setCredentials({
    access_token: tokens.accessToken || undefined,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate || undefined,
  });
  client.on('tokens', (newTokens) => {
    saveGoogleTokens({
      accessToken: newTokens.access_token || tokens.accessToken,
      refreshToken: newTokens.refresh_token || tokens.refreshToken,
      expiryDate: newTokens.expiry_date || tokens.expiryDate,
      email: tokens.email,
    });
  });
  return client;
}

export function getGoogleAccountStatus(redirectUri: string): GoogleAccountStatus {
  const cfg = getGoogleOAuthClientConfig();
  const tokens = getGoogleTokens();
  return {
    configured: !!cfg.clientId && !!cfg.clientSecret,
    connected: !!tokens.refreshToken,
    email: tokens.email,
    redirectUri,
  };
}

export function disconnectGoogle(): void {
  clearGoogleTokens();
}

function decodeEmailFromIdToken(idToken?: string | null): string {
  if (!idToken) return '';
  try {
    const payload = idToken.split('.')[1];
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return json.email || '';
  } catch {
    return '';
  }
}
