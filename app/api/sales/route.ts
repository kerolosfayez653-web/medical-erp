import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


// Generate invoice number: INV-S-YYMMDD-NNNN
async function generateSalesInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const prefix = `INV-S-${yy}${mm}${dd}`;
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personId, items, paidAmount, type, discount = 0, deliveryFee = 0, paymentMethod } = body;

    let itemsTotal = 0;
    for (const item of items) {
      itemsTotal += item.price * item.quantity;
    }

    const total = itemsTotal + parseFloat(deliveryFee) - parseFloat(discount);
    const paymentStatus = paidAmount >= total ? 'CASH' : (paidAmount > 0 ? 'PARTIAL' : 'CREDIT');
    const remaining = total - paidAmount;
    const invoiceNumber = await generateSalesInvoiceNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 0. Pre-calculate COGS
      let totalCogs = 0;
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: parseInt(item.productId) } });
        if (prod) {
          const factor = prod.conversionFactor || 1;
          const effectiveQty = item.unitType === 'SECONDARY' ? parseInt(item.quantity) : (parseInt(item.quantity) * factor);
          totalCogs += effectiveQty * (prod.openingWeightedAvg || 0); // Use MWA for consistency
        }
      }

      // 1. Create Invoice with auto number
      const invoice = await tx.invoice.create({
        data: {
          type: type || 'SALES',
          invoiceNumber,
          personId: personId ? parseInt(personId) : null,
          totalAmount: itemsTotal,
          netAmount: total,
          paidAmount: parseFloat(paidAmount) || 0,
          paymentStatus,
          discount: parseFloat(discount) || 0,
          deliveryFee: parseFloat(deliveryFee) || 0,
          cogs: totalCogs,
          items: {
            create: await Promise.all(items.map(async (i: any) => {
              const product = await tx.product.findUnique({ where: { id: parseInt(i.productId) } });
              const factor = product?.conversionFactor || 1;
              const effectiveQty = i.unitType === 'SECONDARY' ? parseInt(i.quantity) : (parseInt(i.quantity) * factor);
              const price = parseFloat(i.price);
              const qty = parseInt(i.quantity);
              return {
                productId: parseInt(i.productId),
                quantity: effectiveQty,
                unitType: i.unitType || 'PRIMARY',
                price: price,
                total: price * qty,
                totalNet: price * qty // Simple total for now, if item-level discount exists we'd subtract it
              };
            }))
          }
        }
      });

      // 2. Update Person Balance (الديون)
      if (personId) {
        await tx.person.update({
          where: { id: parseInt(personId) },
          data: { currentBalance: { increment: remaining } }
        });
      }

      // 3. Add Payment Record (سند القبض)
      if (paidAmount > 0 && personId) {
        await tx.payment.create({
          data: {
            personId: parseInt(personId),
            invoiceId: invoice.id,
            amount: parseFloat(paidAmount),
            type: 'IN',
            method: paymentMethod || 'كاش',
            notes: 'دفعة من فاتورة المبيعات'
          }
        });
      }

      // 4. Update Inventory Quantities (خصم المخزون - FIFO)
      for (const i of items) {
        let product = await tx.product.findUnique({ where: { id: parseInt(i.productId) } });
        if (!product) continue;

        const factor = product.conversionFactor || 1;
        // If sold as PRIMARY (Box), multiply by factor to get smallest unit qty
        const effectiveQty = i.unitType === 'SECONDARY' ? parseInt(i.quantity) : (parseInt(i.quantity) * factor);
        
        let qtyNeeded = effectiveQty;
        if (qtyNeeded > 0) {
          const lots = await tx.inventoryLot.findMany({
            where: { productId: product.id, quantity: { gt: 0 } },
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
        } else if (qtyNeeded < 0) {
          // It's a return: add back to the first available lot
          const firstLot = await tx.inventoryLot.findFirst({
            where: { productId: product.id },
            orderBy: { expiryDate: 'asc' }
          });
          if (firstLot) {
            await tx.inventoryLot.update({
              where: { id: firstLot.id },
              data: { quantity: { increment: Math.abs(qtyNeeded) } }
            });
            qtyNeeded = 0;
          }
        }

        // If still qtyNeeded > 0, create a deficit lot (optional but consistent with current logic)
        if (qtyNeeded > 0) {
           await tx.inventoryLot.create({
             data: {
               productId: product.id,
               batchNumber: 'DEFICIT',
               expiryDate: new Date('2099-12-31'),
               quantity: -qtyNeeded,
               costPrice: 0,
               sellingPrice: 0
             }
           });
        }
      }

      return invoice;
    });

    return NextResponse.json({ success: true, data: result, invoiceNumber });
  } catch (error) {
    console.error('Invoice Error: ', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
