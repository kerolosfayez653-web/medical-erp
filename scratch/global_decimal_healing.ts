import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating Global Decimal Healing (Standardizing All Quantities)...');

  try {
    // 1. Heal InvoiceItems
    const invoiceItems = await prisma.invoiceItem.findMany({
      include: { product: true }
    });

    console.log(`Analyzing ${invoiceItems.length} Invoice items...`);
    let invoiceCount = 0;

    for (const i of invoiceItems) {
      const factor = i.product.conversionFactor || 1;
      let newQty = Number(i.quantity);

      // If quantity looks like pieces (>= factor) and it is a multi-unit product
      if (factor > 1 && newQty >= factor) {
        newQty = newQty / factor;
        invoiceCount++;
        
        await prisma.invoiceItem.update({
          where: { id: i.id },
          data: { quantity: newQty, unitType: 'PRIMARY' }
        });
      } else {
        // Just ensure unitType is PRIMARY anyway for consistency
        await prisma.invoiceItem.update({
          where: { id: i.id },
          data: { unitType: 'PRIMARY' }
        });
      }
    }
    console.log(`Healed ${invoiceCount} Invoice items.`);

    // 2. Heal QuotationItems
    const quotationItems = await prisma.quotationItem.findMany({
      include: { product: true }
    });

    console.log(`Analyzing ${quotationItems.length} Quotation items...`);
    let quotationCount = 0;

    for (const q of quotationItems) {
      const factor = q.product.conversionFactor || 1;
      let newQty = Number(q.quantity);

      if (factor > 1 && newQty >= factor) {
        newQty = newQty / factor;
        quotationCount++;
        
        await prisma.quotationItem.update({
          where: { id: q.id },
          data: { quantity: newQty, unitType: 'PRIMARY' }
        });
      } else {
        await prisma.quotationItem.update({
          where: { id: q.id },
          data: { unitType: 'PRIMARY' }
        });
      }
    }
    console.log(`Healed ${quotationCount} Quotation items.`);

    console.log('Global Healing Complete.');

  } catch (error) {
    console.error('Healing Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
