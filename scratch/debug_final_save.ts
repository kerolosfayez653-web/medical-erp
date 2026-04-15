import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugSaveFinal() {
  const people = await prisma.person.findMany({ take: 1 });
  const products = await prisma.product.findMany({ take: 1 });
  
  if (people.length === 0 || products.length === 0) {
    console.error('No people or products found! Restore data first.');
    return;
  }

  const pId = people[0].id;
  const prodId = products[0].id;

  console.log(`Testing with Person ID: ${pId}, Product ID: ${prodId}`);

  const body = {
    personId: pId, 
    type: 'SALES',
    items: [
      { productId: prodId, quantity: 1, price: 100, unitType: 'PRIMARY' }
    ],
    paidAmount: 0,
    discount: 0,
    deliveryFee: 0,
    paymentMethod: 'كاش'
  };

  const { items, paidAmount, type, discount = 0, deliveryFee = 0, paymentMethod } = body;

  try {
    const invoiceNumber = 'FINAL-DEBUG-' + Date.now();
    
    await prisma.$transaction(async (tx) => {
      let totalCogs = 0;
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        if (prod) {
          totalCogs += item.quantity * (prod.openingWeightedAvg || 0); 
        }
      }

      console.log('Creating Invoice...');
      const invoice = await tx.invoice.create({
        data: {
          type: type || 'SALES',
          invoiceNumber,
          personId: pId,
          totalAmount: 100,
          netAmount: 100,
          paidAmount: 0,
          paymentStatus: 'CREDIT',
          cogs: totalCogs,
          items: {
            create: [
                {
                    productId: prodId,
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
      console.log('--- SUCCESS: Invoice Created with ID:', invoice.id);
    });
  } catch (err: any) {
    console.error('--- FINAL DEBUG ERROR ---');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

debugSaveFinal();
