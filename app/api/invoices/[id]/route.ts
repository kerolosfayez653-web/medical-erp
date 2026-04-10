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
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInt(id);
  
  try {
    const body = await request.json();
    const { items, personId, discount, deliveryFee, paidAmount, reason } = body;

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
          // Put back sold items to the first available lot
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
          // Find the lot created by this purchase and remove it (or decrease)
          // Since we don't have lotId in InvoiceItem yet, we match by product and batch if possible
          // For now, let's just find the most recent lot for this product
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
        // Price is already per selected unit from UI
        newItemsTotal += parseFloat(item.price) * parseFloat(item.quantity);
      }
      const newTotal = newItemsTotal + (parseFloat(deliveryFee) || 0) - (parseFloat(discount) || 0);
      const newRemaining = newTotal - (parseFloat(paidAmount) || 0);

      // 4. APPLY NEW EFFECTS
      // 4.1 Update Balance
      const newPersonId = personId ? parseInt(personId) : oldInvoice.personId;
      if (newPersonId && newRemaining !== 0) {
        await tx.person.update({
          where: { id: newPersonId },
          data: { currentBalance: { increment: newRemaining } }
        });
      }

      // 4.2 Update Inventory (Similar to create logic)
      for (const item of items) {
        const productId = parseInt(item.productId);
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) continue;

        const factor = product.conversionFactor || 1;
        const effectiveQty = item.unitType === 'SECONDARY' ? parseInt(item.quantity) : (parseInt(item.quantity) * factor);
        
        if (oldInvoice.type === 'SALES') {
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
        } else if (oldInvoice.type === 'PURCHASES') {
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
          personId: newPersonId,
          totalAmount: newTotal,
          paidAmount: parseFloat(paidAmount) || 0,
          paymentStatus: paidAmount >= newTotal ? 'CASH' : 'CREDIT',
          discount: parseFloat(discount) || 0,
          deliveryFee: parseFloat(deliveryFee) || 0,
          items: {
            create: await Promise.all(items.map(async (i: any) => {
              const product = await tx.product.findUnique({ where: { id: parseInt(i.productId) } });
              const factor = product?.conversionFactor || 1;
              const effectiveQty = i.unitType === 'SECONDARY' ? parseInt(i.quantity) : (parseInt(i.quantity) * factor);
              return {
                productId: parseInt(i.productId),
                quantity: effectiveQty,
                unitType: i.unitType || 'PRIMARY',
                price: parseFloat(i.price),
                total: parseFloat(i.price) * parseInt(i.quantity)
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
          action: 'EDIT',
          oldData: JSON.stringify(oldInvoice),
          newData: JSON.stringify(updatedInvoice),
          reason: reason || 'تعديل يدوي'
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

      // 2. DELETE RELATED RECORDS
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });
      await tx.payment.deleteMany({ where: { invoiceId } });
      await tx.invoiceLog.create({
        data: {
          invoiceId: null, // Disconnect from the ID since we are deleting it
          action: 'DELETE',
          oldData: JSON.stringify(invoice),
          reason: `حذف نهائي للفاتورة رقم ${invoice.invoiceNumber || invoiceId}`
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
