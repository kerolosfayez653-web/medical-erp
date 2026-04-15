import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLastItems() {
  console.log('Final Data Fix: Normalizing last 5 syringe purchase records...');

  const itemIds = [2698, 2703, 2754, 2761, 2762];
  
  for (const id of itemIds) {
    const item = await prisma.invoiceItem.findUnique({
      where: { id },
      include: { product: true }
    });

    if (item && item.product) {
      const factor = item.product.conversionFactor || 1;
      console.log(`Fixing Item ${id} (${item.product.name}): Qty ${item.quantity} -> ${item.quantity * factor}, Price ${item.price} -> ${item.price / factor}`);
      
      await prisma.invoiceItem.update({
        where: { id },
        data: {
          quantity: item.quantity * factor,
          price: item.price / factor,
          unitType: 'SECONDARY'
        }
      });
    }
  }

  console.log('Final Strike Complete.');
}

fixLastItems()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
