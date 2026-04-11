import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const people = await prisma.person.findMany({
      orderBy: { name: 'asc' },
      include: {
        invoices: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            id: true,
            invoiceNumber: true,
            type: true,
            totalAmount: true,
            date: true,
            paymentStatus: true,
          }
        }
      }
    });

    // High performance aggregation for dashboard needs
    const [invoiceAgg, paymentAgg] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['personId'],
        _sum: { netAmount: true }
      }),
      prisma.payment.groupBy({
        by: ['personId'],
        _sum: { amount: true }
      })
    ]);

    const invMap = new Map(invoiceAgg.map(i => [i.personId, i._sum.netAmount || 0]));
    const payMap = new Map(paymentAgg.map(p => [p.personId, p._sum.amount || 0]));

    const data = people.map(p => ({
      ...p,
      totalInvoiced: Number(invMap.get(p.id) || 0),
      totalPaid: Number(payMap.get(p.id) || 0),
      lastInvoice: p.invoices[0] || null,
      invoices: undefined,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const person = await prisma.person.create({
      data: {
        name: body.name,
        type: body.type,
        phone: body.phone || null,
        address: body.address || null,
        initialBalance: parseFloat(body.initialBalance) || 0,
        currentBalance: parseFloat(body.initialBalance) || 0,
      }
    });
    return NextResponse.json({ success: true, data: person });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
