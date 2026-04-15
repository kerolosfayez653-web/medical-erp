import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating Rapid SQL Healing (Decimal Transformation)...');

  try {
    // 1. Heal InvoiceItems
    const count = await prisma.$executeRawUnsafe(`
      UPDATE "InvoiceItem" ii
      SET quantity = ii.quantity / p."conversionFactor",
          "unitType" = 'PRIMARY'
      FROM "Product" p
      WHERE ii."productId" = p.id
        AND p."conversionFactor" > 1
        AND ii.quantity >= p."conversionFactor"
    `);
    console.log(`Healed ${count} Invoice items successfully.`);

    // 2. Heal QuotationItems
    const qCount = await prisma.$executeRawUnsafe(`
      UPDATE "QuotationItem" qi
      SET quantity = qi.quantity / p."conversionFactor",
          "unitType" = 'PRIMARY'
      FROM "Product" p
      WHERE qi."productId" = p.id
        AND p."conversionFactor" > 1
        AND qi.quantity >= p."conversionFactor"
    `);
    console.log(`Healed ${qCount} Quotation items successfully.`);

    // 3. Final Verification
    console.log('Verifying Inventory Totals...');
    const res = await fetch('http://localhost:3000/api/inventory').then(r => r.json());
    console.log('FINAL RECONCILED TOTALS:', JSON.stringify(res.totals, null, 2));

    const paragon = res.data.find((x: any) => x.name.includes('بارجون'));
    console.log('Paragon Final Reconciled Stock:', paragon?.currentQty);

  } catch (error) {
    console.error('Rapid Healing Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
