const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'dev-secret-change-me-in-prod';

export function apiHeaders(extra?: HeadersInit): HeadersInit {
  return {
    'X-API-Key': API_KEY,
    ...extra,
  };
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: apiHeaders(init?.headers),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.error || message;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) message = text;
    }
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return res.json();
}

export interface ScoreDriver {
  feature: string;
  label: string;
  direction: 'positive' | 'negative';
  impact: number;
  raw_value: number;
  human_note: string;
}

export interface ScoreData {
  score: number;
  confidence: string;
  model_version: string;
  drivers: ScoreDriver[];
}

export interface ShareToken {
  token: string;
  scope: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export async function fetchScore(businessId: string): Promise<ScoreData> {
  return apiFetch(`/api/businesses/${encodeURIComponent(businessId)}/score`);
}

export async function mintShareToken(
  businessId: string,
  scope: 'SCORE_ONLY' | 'FULL_PROFILE' | 'SNAPSHOT',
  ttlHours: number | null = null
) {
  return apiFetch(`/api/shares?business_id=${encodeURIComponent(businessId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, ttl_hours: ttlHours }),
  });
}

export async function fetchShareHistory(businessId: string): Promise<ShareToken[]> {
  const data = await apiFetch(
    `/api/businesses/${encodeURIComponent(businessId)}/shares`
  );
  return data.tokens ?? [];
}

export async function revokeShareToken(businessId: string, token: string) {
  return apiFetch(
    `/api/shares/${encodeURIComponent(token)}?business_id=${encodeURIComponent(businessId)}`,
    { method: 'DELETE' }
  );
}

export async function resolveShareToken(token: string) {
  return fetch(`/api/shares/${encodeURIComponent(token)}`).then(async (res) => {
    if (!res.ok) {
      let message = 'Failed to resolve share link.';
      try {
        const body = await res.json();
        message = body.detail || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return res.json();
  });
}

export async function triggerIngest(businessId: string, source = 'aa') {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId,
      source,
      consentId: `consent-${Date.now()}`,
      accountId: `account-${Date.now()}`,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || 'We could not start the consent flow.');
  }
  return payload;
}
