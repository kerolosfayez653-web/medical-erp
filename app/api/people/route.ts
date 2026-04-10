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

    const data = people.map(p => ({
      ...p,
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
