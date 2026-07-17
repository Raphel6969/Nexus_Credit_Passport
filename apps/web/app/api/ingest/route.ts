import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_URL || 'http://api:8000';
  const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

  try {
    const body = await request.json().catch(() => ({}));
    const businessId = body.businessId?.trim() || process.env.NEXT_PUBLIC_BUSINESS_ID || '00000000-0000-0000-0000-000000000001';
    const consentId = body.consentId?.trim() || `consent-${Date.now()}`;
    const accountId = body.accountId?.trim() || `account-${Date.now()}`;

    const payload = {
      consentId,
      accountId,
    };

    const res = await fetch(`${apiUrl}/v1/businesses/${businessId}/ingest/aa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
