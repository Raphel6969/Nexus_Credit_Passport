import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || '00000000-0000-0000-0000-000000000001';
  const apiUrl = process.env.API_URL || 'http://api:8000';
  const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

  try {
    const res = await fetch(`${apiUrl}/v1/businesses/${businessId}/score`, {
      headers: {
        'X-API-Key': apiKey,
      },
      next: { revalidate: 0 }, // Disable caching for real-time score updates
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'NO_DATA' }, { status: 404 });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
