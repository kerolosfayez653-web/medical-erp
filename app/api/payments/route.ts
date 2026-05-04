import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
       const payment = await prisma.payment.findUnique({
          where: { id: Number(id), isDeleted: false },
          include: { 
             person: true,
             invoice: {
                select: { invoiceNumber: true }
             }
          }
       });
       return NextResponse.json({ success: true, data: payment });
    }

    const payments = await prisma.payment.findMany({
      where: { isDeleted: false },
      include: { 
        person: true,
        invoice: {
          select: { invoiceNumber: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personId, amount, method, invoiceId, date, notes, type: providedType } = body;

    if (!personId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const paymentDate = date ? new Date(date) : new Date();
      
      const person = await tx.person.findUnique({ where: { id: Number(personId) } });
      if (!person) throw new Error('Person not found');
      
      const type = providedType || (person.type === 'CUSTOMER' ? 'IN' : 'OUT');

      const payment = await tx.payment.create({
        data: {
          personId: Number(personId),
          amount: parseFloat(amount),
          method: method || 'كاش',
          invoiceId: invoiceId ? Number(invoiceId) : null,
          date: paymentDate,
          notes: notes || '',
          type
        }
      });

      // Update Person Balance dynamically based on person.type and payment type
      let balanceChange = 0;
      if (person.type === 'CUSTOMER') {
         balanceChange = (type === 'IN') ? -parseFloat(amount) : parseFloat(amount);
      } else {
         balanceChange = (type === 'OUT') ? -parseFloat(amount) : parseFloat(amount);
      }

      await tx.person.update({
        where: { id: person.id },
        data: { currentBalance: { increment: balanceChange } }
      });

      if (invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: Number(invoiceId) } });
        if (inv) {
          const newPaid = inv.paidAmount + parseFloat(amount);
          const newStatus = newPaid >= inv.netAmount ? 'CASH' : 'PARTIAL';
          await tx.invoice.update({
            where: { id: inv.id },
            data: { paidAmount: newPaid, paymentStatus: newStatus }
          });
        }
      }

      return payment;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, amount, method, notes, date } = body;

    const result = await prisma.$transaction(async (tx) => {
      const old = await tx.payment.findUnique({ where: { id: Number(id) } });
      if (!old) throw new Error('Payment not found');

      const diff = parseFloat(amount) - old.amount;

      const updated = await tx.payment.update({
        where: { id: Number(id) },
        data: {
          amount: parseFloat(amount),
          method,
          notes,
          date: date ? new Date(date) : old.date
        }
      });

      // Adjust Person Balance by the difference
      const person = await tx.person.findUnique({ where: { id: old.personId } });
      let balanceChange = 0;
      if (person?.type === 'CUSTOMER') {
         balanceChange = (old.type === 'IN') ? -diff : diff;
      } else {
         balanceChange = (old.type === 'OUT') ? -diff : diff;
      }
      await tx.person.update({
        where: { id: old.personId },
        data: { currentBalance: { increment: balanceChange } }
      });

      // Adjust Invoice if linked
      if (old.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: old.invoiceId } });
        if (inv) {
          const newPaid = inv.paidAmount + diff;
          await tx.invoice.update({
            where: { id: inv.id },
            data: { 
              paidAmount: newPaid,
              paymentStatus: newPaid >= inv.netAmount ? 'CASH' : 'PARTIAL'
            }
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: Number(id) } });
      if (!payment) throw new Error('Payment not found');

      // Reverse Balance Influence
      const person = await tx.person.findUnique({ where: { id: payment.personId } });
      let reverseChange = 0;
      if (person?.type === 'CUSTOMER') {
         reverseChange = (payment.type === 'IN') ? payment.amount : -payment.amount;
      } else {
         reverseChange = (payment.type === 'OUT') ? payment.amount : -payment.amount;
      }
      await tx.person.update({
        where: { id: payment.personId },
        data: { currentBalance: { increment: reverseChange } }
      });

      // Reverse Invoice Influence
      if (payment.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
        if (inv) {
          const newPaid = inv.paidAmount - payment.amount;
          await tx.invoice.update({
            where: { id: inv.id },
            data: { 
              paidAmount: newPaid,
              paymentStatus: newPaid <= 0 ? 'CREDIT' : (newPaid < inv.netAmount ? 'PARTIAL' : 'CASH')
            }
          });
        }
      }

      return await tx.payment.update({ 
        where: { id: Number(id) },
        data: { isDeleted: true, deletedAt: new Date() }
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
