import pino from 'pino';

const logger = pino({ name: 'mcp-warehouse-ops-iflow', level: process.env.LOG_LEVEL || 'info' });

interface TokenState {
  token: string;
  expiresAt: number;
}

let tokenState: TokenState | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenState && tokenState.expiresAt > now + 30000) {
    return tokenState.token;
  }

  const tokenUrl = process.env.IFLOW_TOKEN_URL;
  const clientId = process.env.IFLOW_CLIENT_ID;
  const clientSecret = process.env.IFLOW_CLIENT_SECRET;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('Missing IFLOW OAuth configuration');
  }

  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  tokenState = {
    token: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  logger.info({ expiresIn: body.expires_in }, 'iflow oauth token acquired');
  return tokenState.token;
}

export async function iflowGet(path: string, query: Record<string, string | number | undefined>) {
  const baseUrl = process.env.IFLOW_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing IFLOW_BASE_URL');
  }

  const apiKey = process.env.IFLOW_API_KEY;
  const accessToken = apiKey ? null : await getAccessToken();
  const url = new URL(path, baseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(apiKey ? { APIKey: apiKey } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`iFlow request failed with ${response.status}`);
  }

  return response.json();
}

export async function iflowPost(path: string, payload: unknown) {
  const baseUrl = process.env.IFLOW_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing IFLOW_BASE_URL');
  }

  const apiKey = process.env.IFLOW_API_KEY;
  const accessToken = apiKey ? null : await getAccessToken();
  const url = new URL(path, baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(apiKey ? { APIKey: apiKey } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    const message = json?.error?.message || `iFlow request failed with ${response.status}`;
    throw new Error(message);
  }

  return json;
}
