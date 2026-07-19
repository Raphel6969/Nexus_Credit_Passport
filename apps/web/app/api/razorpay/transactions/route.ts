import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL || 'http://api:8000';

/**
 * GET /api/razorpay/transactions
 * Returns the current in-memory payment list from the Razorpay mock (via the Python API).
 */
export async function GET() {
  try {
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

/**
 * POST /api/razorpay/transactions
 * Body: { amount: number (paise), email?: string, currency?: string }
 * Appends a new demo payment to the Razorpay mock's in-memory store.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${apiUrl}/v1/razorpay/demo/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }
    return NextResponse.json(await res.json(), { status: 201 });
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
