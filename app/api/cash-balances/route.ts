import { NextResponse } from 'next/server';
import { getCashBalances } from '@/lib/cashBalances';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cashAccounts = await getCashBalances();
    return NextResponse.json({ success: true, cashAccounts });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
