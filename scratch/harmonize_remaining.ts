import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function harmonizeRemaining() {
  console.log('Starting Final Data Harmonization for remaining products...');

  // Common keywords for multi-unit items currently un-normalized
  const keywords = ['جوانتي', 'نابكن', 'بب', 'سرنجة', 'سن', 'ماسك'];
  
  const products = await prisma.product.findMany({
    where: {
      OR: keywords.map(k => ({ name: { contains: k } })),
      conversionFactor: 1,
      openingWeightedAvg: { gt: 50 }
    }
  });

  console.log(`Found ${products.length} suspicious products remaining.`);

  for (const p of products) {
    // Standard factor for these items is 100 (for pieces in a box)
    const factor = 100; 
    console.log(`Normalizing ${p.name}: Factor 1 -> ${factor}, WAC ${p.openingWeightedAvg} -> ${p.openingWeightedAvg / factor}`);
    
    await prisma.product.update({
      where: { id: p.id },
      data: {
        conversionFactor: factor,
        openingWeightedAvg: p.openingWeightedAvg / factor
      }
    });

    // Fix associated items
    const items = await prisma.invoiceItem.findMany({
      where: { productId: p.id, unitType: 'PRIMARY' }
    });

    for (const item of items) {
      // If price looks like box price (> 10x the piece price) 
      // we assume quantity was entered in boxes
      if (item.price > (p.openingWeightedAvg / factor) * 10) {
        console.log(`  Updating Item ${item.id} (Invoice ${item.invoiceId}): Qty ${item.quantity} -> ${item.quantity * factor}`);
        await prisma.invoiceItem.update({
          where: { id: item.id },
          data: {
            quantity: item.quantity * factor,
            price: item.price / factor,
            unitType: 'SECONDARY'
          }
        });
      }
    }
  }

  console.log('Final Harmonization Complete.');
}

harmonizeRemaining()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
