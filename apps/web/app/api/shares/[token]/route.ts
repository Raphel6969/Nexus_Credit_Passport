import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';
const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

// GET /api/shares/[token]  - resolve a share link
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  try {
    const res = await fetch(`${apiUrl}/v1/shares/${token}`, {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    });

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

// DELETE /api/shares/[token]?business_id=...  - revoke a share token
export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');

  if (!businessId) {
    return NextResponse.json({ error: 'Missing business_id' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${apiUrl}/v1/shares/${token}?business_id=${encodeURIComponent(businessId)}`,
      {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ revoked: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
