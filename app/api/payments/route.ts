import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personId, amount, method, invoiceId, date, notes } = body;

    if (!personId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the payment record
      const paymentDate = date ? new Date(date) : new Date();
      const payment = await tx.payment.create({
        data: {
          personId: parseInt(personId),
          amount: parseFloat(amount),
          method: method || 'كاش',
          invoiceId: invoiceId ? parseInt(invoiceId) : null,
          date: paymentDate,
          notes: notes || '',
          type: 'PENDING' // Will derive from person type
        }
      });

      // 2. Determine payment type (IN for Customer, OUT for Supplier)
      const person = await tx.person.findUnique({ where: { id: parseInt(personId) } });
      if (!person) throw new Error('Person not found');
      
      const type = person.type === 'CUSTOMER' ? 'IN' : 'OUT';
      await tx.payment.update({
        where: { id: payment.id },
        data: { type }
      });

      // 3. Update Person Balance
      // Customer payment (IN) decrements their debt (currentBalance)
      // Supplier payment (OUT) decrements what we owe them (currentBalance is usually negative for suppliers in some systems, but here we'll follow previous logic)
      if (type === 'IN') {
        await tx.person.update({
          where: { id: person.id },
          data: { currentBalance: { decrement: parseFloat(amount) } }
        });
      } else {
        await tx.person.update({
          where: { id: person.id },
          data: { currentBalance: { decrement: parseFloat(amount) } }
        });
      }

      // 4. Update Invoice if linked
      if (invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: parseInt(invoiceId) } });
        if (inv) {
          const newPaid = inv.paidAmount + parseFloat(amount);
          const newStatus = newPaid >= inv.netAmount ? 'CASH' : 'PARTIAL';
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              paymentStatus: newStatus
            }
          });
        }
      }

      return payment;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Payment Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
