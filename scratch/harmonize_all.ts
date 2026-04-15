import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function harmonize() {
  console.log('--- Starting Global Inventory Harmonization ---');
  
  // 1. Fix Product Opening Balances
  // If openingQty is like 100, 200, 500 and price is low, it was likely pieces.
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (p.openingQty >= 50 && p.openingWeightedAvg < 20) {
      console.log(`Normalizing Opening Bal for: ${p.name} (${p.openingQty} -> ${p.openingQty/100})`);
      await prisma.product.update({
        where: { id: p.id },
        data: {
          openingQty: p.openingQty / 100,
          openingWeightedAvg: p.openingWeightedAvg * 100
        }
      });
    }
  }

  // 2. Fix Inventory Lots (Current Stock)
  const lots = await prisma.inventoryLot.findMany();
  for (const l of lots) {
    if (l.quantity >= 50 && l.costPrice < 20) {
      console.log(`Normalizing Lot for Product ID ${l.productId}: (${l.quantity} -> ${l.quantity/100})`);
      await prisma.inventoryLot.update({
        where: { id: l.id },
        data: {
          quantity: l.quantity / 100,
          costPrice: l.costPrice * 100,
          sellingPrice: l.sellingPrice * 100
        }
      });
    }
  }

  // 3. Fix Invoice Items (Transactions)
  const items = await prisma.invoiceItem.findMany();
  for (const i of items) {
    // If quantity is huge (e.g. 2000) and price is tiny (e.g. 2.25)
    if (i.quantity >= 50 && i.price < 20) {
       console.log(`Normalizing InvoiceItem for Product ID ${i.productId}: (${i.quantity} -> ${i.quantity/100})`);
       await prisma.invoiceItem.update({
         where: { id: i.id },
         data: {
           quantity: i.quantity / 100,
           price: i.price * 100,
           costPrice: i.costPrice ? i.costPrice * 100 : null
         }
       });
    }
  }

  console.log('--- Harmonization Complete ---');
}

harmonize().catch(console.error);
