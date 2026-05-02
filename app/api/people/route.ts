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
        by: ['personId', 'type'],
        where: { isDeleted: false },
        _sum: { netAmount: true }
      }),
      prisma.payment.groupBy({
        by: ['personId', 'type'],
        where: { isDeleted: false },
        _sum: { amount: true }
      })
    ]);

    const getAgg = (pid: number, type: string, arr: any[], sumField: string) => {
      return arr.find(a => a.personId === pid && a.type === type)?._sum?.[sumField] || 0;
    };

    const data = people.map(p => {
      // Invoices: SALES items are positive, SALES_RETURN are negative for customers (reversed for suppliers)
      const sales = getAgg(p.id, 'SALES', invoiceAgg, 'netAmount') - getAgg(p.id, 'SALES_RETURN', invoiceAgg, 'netAmount');
      const purchases = getAgg(p.id, 'PURCHASES', invoiceAgg, 'netAmount') - getAgg(p.id, 'PURCHASES_RETURN', invoiceAgg, 'netAmount');
      
      // Payments: IN is money we received, OUT is money we paid
      const payIn = getAgg(p.id, 'IN', paymentAgg, 'amount');
      const payOut = getAgg(p.id, 'OUT', paymentAgg, 'amount');

      const totalInvoiced = p.type === 'CUSTOMER' ? sales : purchases;
      const totalPaid = p.type === 'CUSTOMER' ? (payIn - payOut) : (payOut - payIn);

      return {
        ...p,
        totalInvoiced,
        totalPaid,
        lastInvoice: p.invoices[0] || null,
        invoices: undefined,
      };
    });

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
