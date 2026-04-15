import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({ 
        where: { isDeleted: true }, 
        include: { person: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.payment.findMany({ 
        where: { isDeleted: true }, 
        include: { person: true },
        orderBy: { deletedAt: 'desc' }
      })
    ]);

    const data = [
      ...invoices.map(i => ({ ...i, trashType: 'INVOICE' })),
      ...payments.map(p => ({ ...p, trashType: 'PAYMENT' }))
    ].sort((a,b) => (new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id, type } = await request.json();
    
    const result = await prisma.$transaction(async (tx) => {
      if (type === 'INVOICE') {
        const inv = await tx.invoice.findUnique({
          where: { id },
          include: { items: true }
        });
        if (!inv || !inv.isDeleted) throw new Error('Invoice not found or not in trash');

        // RE-APPLY EFFECTS
        // 1. Balance
        if (inv.personId) {
          const remaining = inv.totalAmount - inv.paidAmount;
          if (remaining !== 0) {
            await tx.person.update({
              where: { id: inv.personId },
              data: { currentBalance: { increment: remaining } }
            });
          }
        }
        // 2. Inventory
        for (const item of inv.items) {
          if (inv.type === 'SALES') {
            let qtyNeeded = item.quantity;
            const lots = await tx.inventoryLot.findMany({
              where: { productId: item.productId, quantity: { gt: 0 } },
              orderBy: { expiryDate: 'asc' }
            });
            for (const lot of lots) {
              if (qtyNeeded <= 0) break;
              const deduction = Math.min(lot.quantity, qtyNeeded);
              await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantity: { decrement: deduction } } });
              qtyNeeded -= deduction;
            }
          } else if (inv.type === 'PURCHASES') {
            // Purchases create a new lot (simplified)
            await tx.inventoryLot.create({
              data: {
                productId: item.productId,
                batchNumber: `RESTORED-${inv.id}`,
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                quantity: item.quantity,
                costPrice: item.price,
                sellingPrice: item.price * 1.25,
              }
            });
          }
        }

        return await tx.invoice.update({
          where: { id },
          data: { isDeleted: false, deletedAt: null }
        });
      } else {
        const pay = await tx.payment.findUnique({ where: { id } });
        if (!pay || !pay.isDeleted) throw new Error('Payment not found or not in trash');

        // RE-APPLY EFFECTS
        // 1. Balance
        await tx.person.update({
          where: { id: pay.personId },
          data: { currentBalance: { decrement: pay.amount } }
        });
        // 2. Linked Invoice
        if (pay.invoiceId) {
          const inv = await tx.invoice.findUnique({ where: { id: pay.invoiceId } });
          if (inv) {
            const newPaid = inv.paidAmount + pay.amount;
            await tx.invoice.update({
              where: { id: inv.id },
              data: { 
                paidAmount: newPaid,
                paymentStatus: newPaid >= inv.netAmount ? 'CASH' : 'PARTIAL'
              }
            });
          }
        }

        return await tx.payment.update({
          where: { id },
          data: { isDeleted: false, deletedAt: null }
        });
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id, type } = await request.json();
    if (type === 'INVOICE') {
      await prisma.invoice.delete({ where: { id } });
    } else {
      await prisma.payment.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
