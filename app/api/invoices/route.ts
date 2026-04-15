import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id            = searchParams.get('id');
    
    // Strict Single-ID Lookup (Fixes bug where latest invoice was returned)
    if (id && id !== 'undefined' && id !== 'null') {
      const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(id) },
        include: {
          person: true,
          items: { include: { product: { select: { name: true, unit: true, secondaryUnit: true, conversionFactor: true } } } },
          payments: true,
        }
      });
      return NextResponse.json(
        { 
          success: true, 
          data: invoice ? [invoice] : [], 
          meta: { 
            requestedId: id, 
            resolvedId: invoice?.id, 
            resolvedInvoiceNumber: invoice?.invoiceNumber,
            timestamp: Date.now() 
          } 
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } }
      );
    }

    const startDate     = searchParams.get('startDate');
    const endDate       = searchParams.get('endDate');
    const personId      = searchParams.get('personId');
    const creationType  = searchParams.get('creationType'); // INIT_CASH, INIT_CREDIT
    const method        = searchParams.get('method');
    const paymentStatus = searchParams.get('paymentStatus'); // CASH, CREDIT
    const type          = searchParams.get('type'); // SALES, PURCHASES

    const where: any = {};
    if (id) where.id = parseInt(id);
    if (type && type !== 'ALL') where.type = type;
    if (paymentStatus && paymentStatus !== 'ALL') {
       if (paymentStatus === 'CREDIT') {
          where.paymentStatus = { in: ['CREDIT', 'PARTIAL'] };
       } else {
          where.paymentStatus = paymentStatus;
       }
       
       // Applied to both Credit and Partial selections: 
       // Hide any unpaid status if the account balance is settled (<= 0.1 for float safety)
       if (paymentStatus === 'CREDIT' || paymentStatus === 'PARTIAL') {
          where.NOT = {
            AND: [
              { paymentStatus: { in: ['CREDIT', 'PARTIAL'] } },
              { person: { currentBalance: { lte: 0.1 } } }
            ]
          };
       }
    }
    if (personId && personId !== 'ALL') where.personId = parseInt(personId);
    
    if (creationType === 'INIT_CASH') {
       where.payments = { none: {} };
       where.paymentStatus = 'CASH'; // Originally cash implies it's paid now too (usually)
    } else if (creationType === 'INIT_CREDIT') {
       // Either has payments or is still credit/partial
       where.OR = [
          { payments: { some: {} } },
          { paymentStatus: { in: ['CREDIT', 'PARTIAL'] } }
       ];
    }

    if (method && method !== 'ALL') {
       const methodFilter = { OR: [
          { paymentMethod: method },
          { payments: { some: { method } } }
       ]};
       if (where.OR) {
          // Merge with existing OR if needed
          where.AND = [ { OR: where.OR }, methodFilter ];
          delete where.OR;
       } else {
          where.OR = methodFilter.OR;
       }
    }

    if ((startDate && startDate !== 'null') || (endDate && endDate !== 'null')) {
      where.date = {};
      if (startDate && startDate !== 'null') {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) where.date.gte = d;
      }
      if (endDate && endDate !== 'null') {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) where.date.lte = d;
      }
      // If the date object ended up empty (invalid dates), remove it
      if (Object.keys(where.date).length === 0) delete where.date;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        person: true,
        items: { include: { product: { select: { name: true, unit: true, secondaryUnit: true, conversionFactor: true } } } },
        payments: true,
      },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
