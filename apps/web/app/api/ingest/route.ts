import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_URL || 'http://api:8000';
  const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

  try {
    const body = await request.json().catch(() => ({}));
    const businessId = body.businessId?.trim() || process.env.NEXT_PUBLIC_BUSINESS_ID || '00000000-0000-0000-0000-000000000001';
    const source = body.source?.trim() || 'aa';
    const consentId = body.consentId?.trim() || `consent-${Date.now()}`;
    const accountId = body.accountId?.trim() || `account-${Date.now()}`;

    const payload: Record<string, string> = {
      accountId,
    };
    if (source === 'aa') {
      payload.consentId = consentId;
    }

    const coreSources = ['aa', 'gstn', 'razorpay', 'zoho', 'tally'];
    if (!coreSources.includes(source)) {
      // Mock successful ingestion run for non-core demo adapters
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return NextResponse.json({
        status: 'success',
        message: `Mock synced ${source} data successfully`,
      });
    }

    const res = await fetch(`${apiUrl}/v1/businesses/${businessId}/ingest/${source}`, {
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
