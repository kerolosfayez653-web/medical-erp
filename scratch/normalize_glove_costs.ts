import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function normalizeGloveCosts() {
  console.log('Final Data Normalization: Fixing Glove Costs...');

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'جوانتي' } },
        { name: { contains: 'سرنجة' } },
        { name: { contains: 'مشرط' } }
      ]
    }
  });

  console.log(`Analyzing ${products.length} multi-unit products...`);
  for (const p of products) {
    const factor = p.conversionFactor || 1;
    // If it's a box price (usually > 10 EGP for these items) and factor is > 1
    if (factor > 1 && p.openingWeightedAvg > 10) {
      const newWAC = p.openingWeightedAvg / factor;
      console.log(`Normalizing ${p.name}: Cost ${p.openingWeightedAvg} -> ${newWAC} (Factor: ${factor})`);
      await prisma.product.update({
        where: { id: p.id },
        data: { openingWeightedAvg: newWAC }
      });
    }
  }

  console.log('Normalization Complete.');
}

normalizeGloveCosts()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
