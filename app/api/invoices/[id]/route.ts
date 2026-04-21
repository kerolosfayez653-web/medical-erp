import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: { include: { product: true } },
        person: true,
        payments: true,
        logs: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json(
      { success: true, data: invoice, meta: { fetchedId: id, timestamp: Date.now() } },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInt(id);
  
  try {
    const body = await _request.json();
    const { items, personId, date, type, discount, deliveryFee, paidAmount, reason } = body;

    const oldInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, person: true }
    });

    if (!oldInvoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      // 1. REVERSE OLD EFFECTS
      // 1.1 Reverse Balance
      if (oldInvoice.personId) {
        const oldRemaining = oldInvoice.totalAmount - oldInvoice.paidAmount;
        if (oldRemaining !== 0) {
          await tx.person.update({
            where: { id: oldInvoice.personId },
            data: { currentBalance: { decrement: oldRemaining } }
          });
        }
      }

      // 1.2 Reverse Inventory
      for (const item of oldInvoice.items) {
        if (oldInvoice.type === 'SALES' || oldInvoice.type === 'SALES_RETURN') {
          const firstLot = await tx.inventoryLot.findFirst({
            where: { productId: item.productId },
            orderBy: { id: 'asc' }
          });
          if (firstLot) {
            await tx.inventoryLot.update({
              where: { id: firstLot.id },
              data: { quantity: { increment: item.quantity } }
            });
          }
        } else if (oldInvoice.type === 'PURCHASES' || oldInvoice.type === 'PURCHASES_RETURN') {
          const lot = await tx.inventoryLot.findFirst({
            where: { productId: item.productId, quantity: { gte: item.quantity } },
            orderBy: { id: 'desc' }
          });
          if (lot) {
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { quantity: { decrement: item.quantity } }
            });
          }
        }
      }

      // 2. DELETE OLD ITEMS
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });

      // 3. CALCULATE NEW TOTALS
      let newItemsTotal = 0;
      for (const item of items) {
        newItemsTotal += (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
      }
      const newTotal = newItemsTotal;
      const netAmount = newTotal + (parseFloat(deliveryFee) || 0) - (parseFloat(discount) || 0);
      const newRemaining = netAmount - (parseFloat(paidAmount) || 0);

      // 4. APPLY NEW EFFECTS
      // 4.1 Update Balance
      const targetPersonId = personId ? parseInt(personId) : oldInvoice.personId;
      if (targetPersonId && newRemaining !== 0) {
        await tx.person.update({
          where: { id: targetPersonId },
          data: { currentBalance: { increment: newRemaining } }
        });
      }

      // 4.2 Update Inventory
      const activeType = type || oldInvoice.type;
      for (const item of items) {
        const productId = parseInt(item.productId);
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) continue;

        const factor = product.conversionFactor || 1;
        const effectiveQty = item.unitType === 'SECONDARY' ? parseFloat(item.quantity) : (parseFloat(item.quantity) * factor);
        
        if (activeType === 'SALES') {
           let qtyNeeded = effectiveQty;
           const lots = await tx.inventoryLot.findMany({
             where: { productId, quantity: { gt: 0 } },
             orderBy: { expiryDate: 'asc' }
           });
           for (const lot of lots) {
             if (qtyNeeded <= 0) break;
             const deduction = Math.min(lot.quantity, qtyNeeded);
             await tx.inventoryLot.update({
               where: { id: lot.id },
               data: { quantity: { decrement: deduction } }
             });
             qtyNeeded -= deduction;
           }
        } else if (activeType === 'PURCHASES') {
          await tx.inventoryLot.create({
            data: {
              productId,
              batchNumber: item.batchNumber || `EDIT-${invoiceId}`,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              quantity: effectiveQty,
              costPrice: parseFloat(item.price),
              sellingPrice: parseFloat(item.sellingPrice) || parseFloat(item.price) * 1.25,
            }
          });
        }
      }

      // 5. UPDATE INVOICE
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          personId: targetPersonId,
          date: date ? new Date(date) : oldInvoice.date,
          type: activeType,
          totalAmount: newTotal,
          netAmount: netAmount,
          paidAmount: parseFloat(paidAmount) || 0,
          paymentStatus: paidAmount >= netAmount ? 'CASH' : 'CREDIT',
          discount: parseFloat(discount) || 0,
          deliveryFee: parseFloat(deliveryFee) || 0,
          items: {
            create: await Promise.all(items.map(async (i: any) => {
              const product = await tx.product.findUnique({ where: { id: parseInt(i.productId) } });
              const factor = product?.conversionFactor || 1;
              const effectiveQty = i.unitType === 'SECONDARY' ? parseFloat(i.quantity) : (parseFloat(i.quantity) * factor);
              return {
                productId: parseInt(i.productId),
                quantity: effectiveQty,
                unitType: i.unitType || 'PRIMARY',
                price: parseFloat(i.price) || 0,
                total: (parseFloat(i.price) || 0) * (parseFloat(i.quantity) || 0)
              };
            }))
          }
        },
        include: { items: true }
      });

      // 6. LOG THE CHANGE
      await tx.invoiceLog.create({
        data: {
          invoiceId,
          action: 'EDIT_FULL',
          oldData: JSON.stringify(oldInvoice),
          newData: JSON.stringify(updatedInvoice),
          reason: reason || 'تعديل شامل للفاتورة'
        }
      });

      return updatedInvoice;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Update Invoice Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInt(id);

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, person: true }
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      // 1. REVERSE EFFECTS
      // 1.1 Reverse Balance
      if (invoice.personId) {
        const remaining = invoice.totalAmount - invoice.paidAmount;
        if (remaining !== 0) {
          await tx.person.update({
            where: { id: invoice.personId },
            data: { currentBalance: { decrement: remaining } }
          });
        }
      }

      // 1.2 Reverse Inventory
      for (const item of invoice.items) {
        if (invoice.type === 'SALES' || invoice.type === 'SALES_RETURN') {
          const firstLot = await tx.inventoryLot.findFirst({
            where: { productId: item.productId },
            orderBy: { id: 'asc' }
          });
          if (firstLot) {
            await tx.inventoryLot.update({
              where: { id: firstLot.id },
              data: { quantity: { increment: item.quantity } }
            });
          }
        } else if (invoice.type === 'PURCHASES' || invoice.type === 'PURCHASES_RETURN') {
          const lot = await tx.inventoryLot.findFirst({
            where: { productId: item.productId, quantity: { gte: item.quantity } },
            orderBy: { id: 'desc' }
          });
          if (lot) {
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { quantity: { decrement: item.quantity } }
            });
          }
        }
      }

      // 2. SOFT-DELETE RELATED RECORDS (do not hard-delete items so they can be restored)
      await tx.payment.updateMany({ 
        where: { invoiceId },
        data: { isDeleted: true, deletedAt: new Date() }
      });
      // Note: We leave invoiceItems alone. Since they belong to a soft-deleted invoice, 
      // they remain untouched in the DB and are restored when the invoice is restored.
      
      await tx.invoiceLog.create({
        data: {
          invoiceId: invoiceId, // Keep it linked to track history even in trash
          action: 'DELETE',
          oldData: JSON.stringify(invoice),
          reason: `حذف (نقل للمهملات) للفاتورة رقم ${invoice.invoiceNumber || invoiceId}`
        }
      });
      
      // 3. DELETE INVOICE
      await tx.invoice.delete({ where: { id: invoiceId } });

      return { success: true };
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Invoice Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
