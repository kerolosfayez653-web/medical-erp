import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fullRollback() {
  console.log('EMERGENCY ROLLBACK: Reversing all data harmonization changes...');

  // 1. REVERT PRODUCTS (Scalpels, Syringes, Gloves, etc.)
  // We target items where factor > 1 and we recently updated them
  const products = await prisma.product.findMany({
    where: { conversionFactor: { gt: 1 } }
  });

  console.log(`Found ${products.length} products to potentially revert.`);
  for (const p of products) {
    const factor = p.conversionFactor;
    console.log(`Reverting Product ${p.name}: Factor ${factor} -> 1, WAC ${p.openingWeightedAvg} -> ${p.openingWeightedAvg * factor}`);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        conversionFactor: 1,
        openingWeightedAvg: p.openingWeightedAvg * factor,
        unit: 'علبة',
        secondaryUnit: p.name.includes('مشرط') ? 'مشرط' : 'قطعة'
      }
    });

    // 2. REVERT ITEMS
    // We target items that were changed to SECONDARY
    const items = await prisma.invoiceItem.findMany({
      where: { productId: p.id, unitType: 'SECONDARY' }
    });
    for (const item of items) {
       console.log(`  Reverting Item ${item.id}: Qty ${item.quantity} -> ${item.quantity / factor}`);
       await prisma.invoiceItem.update({
         where: { id: item.id },
         data: {
           unitType: 'PRIMARY',
           quantity: item.quantity / factor,
           price: item.price * factor
         }
       });
    }
  }

  console.log('Rollback Complete.');
}

fullRollback()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
