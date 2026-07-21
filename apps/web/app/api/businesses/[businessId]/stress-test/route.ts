import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';
const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

// GET /api/businesses/[businessId]/stress-test
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const { businessId } = params;
  const searchParams = request.nextUrl.searchParams;

  try {
    const res = await fetch(
      `${apiUrl}/v1/businesses/${encodeURIComponent(businessId)}/stress-test?${searchParams.toString()}`,
      {
        headers: { 'X-API-Key': apiKey },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      let detail = 'Request failed';
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch {
        const text = await res.text();
        if (text) detail = text;
      }
      return NextResponse.json({ error: detail, detail }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
