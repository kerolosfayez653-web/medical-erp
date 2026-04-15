import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function harmonizeProducts() {
  console.log('Starting Master Data Harmonization...');

  // 1. Target Scalpels (مشرط)
  const scalpels = await prisma.product.findMany({
    where: { 
      name: { contains: 'مشرط' },
      conversionFactor: 1,
      openingWeightedAvg: { gt: 50 } 
    }
  });

  console.log(`Found ${scalpels.length} un-normalized scalpels.`);
  for (const p of scalpels) {
    console.log(`Normalizing ${p.name}: Factor 1 -> 100, WAC ${p.openingWeightedAvg} -> ${p.openingWeightedAvg / 100}`);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        conversionFactor: 100,
        openingWeightedAvg: p.openingWeightedAvg / 100,
        unit: 'علبة',
        secondaryUnit: 'مشرط'
      }
    });

    // Also update associated invoice items if they were recorded as 1 box = 1 qty
    // BUT only if total matches (Price * Quantity) and Price is Box Price (~200-300).
    const items = await prisma.invoiceItem.findMany({
      where: { productId: p.id, unitType: 'PRIMARY' }
    });
    for (const item of items) {
      if (Math.abs(item.total - (item.price * item.quantity)) < 0.1 && item.price > 50) {
        console.log(`  Converting Sales Item ${item.id}: Qty ${item.quantity} -> ${item.quantity * 100}, Price ${item.price} -> ${item.price / 100}`);
        await prisma.invoiceItem.update({
          where: { id: item.id },
          data: {
            quantity: item.quantity * 100,
            price: item.price / 100,
            unitType: 'SECONDARY'
          }
        });
      }
    }
  }

  // 2. Target Syringes (سرنجة)
  const syringes = await prisma.product.findMany({
    where: { 
      name: { contains: 'سرنجة' },
      conversionFactor: 1,
      openingWeightedAvg: { gt: 50 } 
    }
  });

  console.log(`Found ${syringes.length} un-normalized syringes.`);
  for (const p of syringes) {
    console.log(`Normalizing ${p.name}: Factor 1 -> 100, WAC ${p.openingWeightedAvg} -> ${p.openingWeightedAvg / 100}`);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        conversionFactor: 100,
        openingWeightedAvg: p.openingWeightedAvg / 100,
        unit: 'علبة',
        secondaryUnit: 'سرنجة'
      }
    });
  }

  console.log('Harmonization Complete.');
}

harmonizeProducts()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
