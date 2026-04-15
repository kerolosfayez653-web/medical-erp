import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalEqualizer() {
  console.log('Final Database Equalization: Restoring Boxes/Primary Base...');

  const multiUnitProducts = await prisma.product.findMany({
    where: {
      conversionFactor: { gt: 1 }
    }
  });

  console.log(`Auditing ${multiUnitProducts.length} multi-unit products...`);
  
  for (const p of multiUnitProducts) {
    const factor = p.conversionFactor || 1;
    
    // If openingWeightedAvg is already normalized to piece-cost (usually < 10 for these items)
    // and openingQty is suspiciously high (indicating it might have been normalized to pieces)
    // Actually, based on previous steps, I know which ones I modified.
    // The safest check is: Is WAC suspiciously low for a Box price?
    
    if (p.openingWeightedAvg < 20 && p.openingQty >= 1) {
       console.log(`Equalizing ${p.name}:`);
       const restoredWAC = p.openingWeightedAvg * factor;
       const restoredQty = p.openingQty / factor; // If it was 100 pieces -> 1 box
       
       console.log(`  WAC: ${p.openingWeightedAvg} -> ${restoredWAC}`);
       console.log(`  Qty: ${p.openingQty} -> ${restoredQty}`);
       
       await prisma.product.update({
         where: { id: p.id },
         data: {
           openingWeightedAvg: restoredWAC,
           openingQty: restoredQty
         }
       });
    }
  }

  console.log('Equalization Complete.');
}

finalEqualizer()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
