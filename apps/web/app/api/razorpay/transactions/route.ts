import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';
const apiKey = process.env.API_KEY || 'dev-secret-change-me-in-prod';



/**
 * POST /api/razorpay/transactions
 * Body: { amount: number (paise), email?: string, currency?: string }
 * Appends a new demo payment to the Razorpay mock's in-memory store.
 */
export async function POST(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('mode') || 'demo';
    const businessId = request.nextUrl.searchParams.get('businessId') || '';
    const body = await request.json();

    let res: Response;
    if (mode === 'live') {
      if (!businessId) {
        return NextResponse.json({ error: 'businessId is required for live mode' }, { status: 400 });
      }
      res = await fetch(`${apiUrl}/v1/businesses/${encodeURIComponent(businessId)}/ingest/manual-upi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          amountPaise: body.amount,
          payerHandle: body.email || '',
          payerName: body.payerName || '',
          upiRef: body.upiRef || '',
        }),
      });
    } else {
      res = await fetch(`${apiUrl}/v1/razorpay/demo/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }
    return NextResponse.json(await res.json(), { status: mode === 'live' ? 202 : 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/razorpay/transactions
 * Resets the Razorpay mock back to seed data.
 */
export async function DELETE() {
  try {
    const res = await fetch(`${apiUrl}/v1/razorpay/demo/transactions/reset`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/razorpay/transactions?mode=live&businessId=...
 * In live mode, list recent UPI credits from Postgres.
 */
export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('mode') || 'demo';
    const businessId = request.nextUrl.searchParams.get('businessId') || '';

    if (mode === 'live') {
      if (!businessId) {
        return NextResponse.json({ error: 'businessId is required for live mode' }, { status: 400 });
      }
      const res = await fetch(
        `${apiUrl}/v1/businesses/${encodeURIComponent(businessId)}/transactions/upi`,
        {
          cache: 'no-store',
          headers: { 'X-API-Key': apiKey },
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: errText }, { status: res.status });
      }
      return NextResponse.json(await res.json());
    }

    const res = await fetch(`${apiUrl}/v1/razorpay/demo/transactions`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
