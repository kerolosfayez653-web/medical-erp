import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repairUnits() {
  console.log('Starting Data Repair: Unit Normalization...');

  const items = await prisma.invoiceItem.findMany({
    where: {
      unitType: 'PRIMARY',
      invoice: { isDeleted: false },
      product: { conversionFactor: { gt: 1 } }
    },
    include: { product: true, invoice: true }
  });

  console.log(`Found ${items.length} potential candidates for unit correction.`);

  let updatedCount = 0;

  for (const item of items) {
    const factor = item.product.conversionFactor || 1;
    
    // Heuristic 1: Total matches (Price * Quantity) 
    // This strongly implies the quantity was entered in the intended unit (likely pieces)
    const matchesPriceQty = Math.abs(item.total - (item.price * item.quantity)) < 0.1;
    
    // Heuristic 2: If we multiply by factor, the price becomes extremely low or the quantity extremely high
    // e.g. 100 boxes of scalpels is unlikely, but 100 pieces (1 box) is likely.
    
    if (matchesPriceQty) {
      console.log(`Fixing Item ${item.id} (${item.product.name}): Switching PRIMARY -> SECONDARY (Qty: ${item.quantity})`);
      
      await prisma.invoiceItem.update({
        where: { id: item.id },
        data: { unitType: 'SECONDARY' }
      });
      updatedCount++;
    }
  }

  console.log(`Repair Complete. Updated ${updatedCount} items.`);
}

repairUnits()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
