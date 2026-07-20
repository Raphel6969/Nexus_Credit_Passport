import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';
const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

// GET /api/businesses/[businessId]/dashboard
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const { businessId } = params;

  try {
    const res = await fetch(
      `${apiUrl}/v1/businesses/${encodeURIComponent(businessId)}/dashboard`,
      {
        headers: { 'X-API-Key': apiKey },
        cache: 'no-store',
      }
    );

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
