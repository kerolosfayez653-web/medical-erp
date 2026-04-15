import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugSave() {
  const body = {
    personId: 1, 
    type: 'SALES',
    items: [
      { productId: 1, quantity: 1, price: 100, unitType: 'PRIMARY' }
    ],
    paidAmount: 0,
    discount: 0,
    deliveryFee: 0,
    paymentMethod: 'كاش'
  };

  const { personId, items, paidAmount, type, discount = 0, deliveryFee = 0, paymentMethod } = body;

  try {
    const invoiceNumber = 'DEBUG-' + Date.now();
    
    await prisma.$transaction(async (tx) => {
      let totalCogs = 0;
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        if (prod) {
          const factor = Number(prod.conversionFactor) || 1;
          const effectiveQty = item.unitType === 'SECONDARY' ? Number(item.quantity) : (Number(item.quantity) * factor);
          totalCogs += effectiveQty * (prod.openingWeightedAvg || 0); 
        }
      }

      console.log('Building Invoice...');
      const invoice = await tx.invoice.create({
        data: {
          type: type || 'SALES',
          invoiceNumber,
          personId: personId ? Number(personId) : null,
          totalAmount: 100,
          netAmount: 100,
          paidAmount: parseFloat(paidAmount as any) || 0,
          paymentStatus: 'CREDIT',
          discount: parseFloat(discount as any) || 0,
          deliveryFee: parseFloat(deliveryFee as any) || 0,
          cogs: totalCogs,
          items: {
            create: [
                {
                    productId: 1,
                    quantity: 1,
                    unitType: 'PRIMARY',
                    price: 100,
                    total: 100,
                    totalNet: 100
                }
            ]
          }
        }
      });
      console.log('Invoice created:', invoice.id);
    });
  } catch (err: any) {
    console.error('--- DEBUG ERROR ---');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

debugSave();
