import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const method = searchParams.get('method');

    if (!method) {
      return NextResponse.json({ error: 'Method is required' }, { status: 400 });
    }

    // Default cash opening balance
    const isMainCash = method === 'كاش';
    const OPENING_CASH = 10278; 
    let runningBalance = isMainCash ? OPENING_CASH : 0;

    // 1. Get Payments (IN/OUT)
    const payments = await prisma.payment.findMany({
      where: { method: method, isDeleted: false },
      include: { person: true }
    });

    // 2. Get Expenses
    const expenses = await prisma.expense.findMany({
      where: { paymentMethod: method }
    });

    // 3. Get Transfers IN (where toMethod == method)
    const transfersIn = await prisma.transfer.findMany({
      where: { toMethod: method }
    });

    // 4. Get Transfers OUT (where fromMethod == method)
    const transfersOut = await prisma.transfer.findMany({
      where: { fromMethod: method }
    });

    // Merge all into a unified ledger array
    const ledger: any[] = [];

    // Opening Balance Entry (if any)
    if (runningBalance !== 0) {
      ledger.push({
        id: 'opening',
        date: new Date('2026-01-01T00:00:00Z'),
        type: 'OPENING',
        description: 'رصيد افتتاحي',
        debit: runningBalance > 0 ? runningBalance : 0,
        credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
        balance: 0 // Will be calculated
      });
    }

    payments.forEach(p => {
      ledger.push({
        id: `pay-${p.id}`,
        date: p.date,
        type: p.type === 'IN' ? 'PAY_IN' : 'PAY_OUT',
        description: `سند ${p.type === 'IN' ? 'تحصيل من' : 'دفع إلى'} ${p.person.name}`,
        notes: p.notes,
        debit: p.type === 'IN' ? p.amount : 0,
        credit: p.type === 'OUT' ? p.amount : 0,
        balance: 0
      });
    });

    expenses.forEach(e => {
      ledger.push({
        id: `exp-${e.id}`,
        date: e.date,
        type: 'EXPENSE',
        description: `مصروف: ${e.category} - ${e.description || ''}`,
        notes: '',
        debit: 0,
        credit: e.amount,
        balance: 0
      });
    });

    transfersIn.forEach(t => {
      ledger.push({
        id: `trin-${t.id}`,
        date: t.date,
        type: 'TRANSFER_IN',
        description: `تحويل وارد من ${t.fromMethod}`,
        notes: t.notes,
        debit: t.amount,
        credit: 0,
        balance: 0
      });
    });

    transfersOut.forEach(t => {
      ledger.push({
        id: `trout-${t.id}`,
        date: t.date,
        type: 'TRANSFER_OUT',
        description: `تحويل صادر إلى ${t.toMethod}`,
        notes: t.notes,
        debit: 0,
        credit: t.amount,
        balance: 0
      });
    });

    // Sort chronologically
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let currentBal = 0;
    ledger.forEach(entry => {
      currentBal += (entry.debit - entry.credit);
      entry.balance = currentBal;
    });

    // Reverse so newest is at the top
    ledger.reverse();

    return NextResponse.json({ success: true, ledger, currentBalance: currentBal });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
