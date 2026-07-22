import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';
const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';

// POST /api/ocen/broadcast
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${apiUrl}/v1/ocen/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = 'OCEN Broadcast failed';
      try {
        const payload = await res.json();
        detail = payload.detail || payload.error || detail;
      } catch {
        const text = await res.text();
        if (text) detail = text;
      }
      return NextResponse.json({ error: detail }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
