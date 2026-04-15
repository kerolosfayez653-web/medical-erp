import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Data Normalization...");

  const products = await prisma.product.findMany({
    include: {
      invoiceItems: true,
      lots: true
    }
  });

  for (const product of products) {
    const factor = product.conversionFactor || 1;
    if (factor <= 1) continue;

    console.log(`Processing Product: ${product.name} (Factor: ${factor})`);

    // 1. Normalize InvoiceItems
    for (const item of product.invoiceItems) {
      let needsUpdate = false;
      let newQty = item.quantity;
      let newPrice = item.price;

      // Heuristic 1: If price * quantity matches total, but quantity is very small
      // and item is PRIMARY, it might be stored in BOXES.
      const isLikelyBoxes = (item.unitType === 'PRIMARY' || !item.unitType) && 
                            Math.abs(item.price * item.quantity - item.total) < 0.5 && 
                            item.quantity < 100; // Heuristic: boxes are usually small numbers

      // Heuristic 2: If price * quantity >> total, then price is likely BOX PRICE while quantity is PIECES
      const isPriceBoxQuantityPieces = Math.abs((item.price / factor) * item.quantity - item.total) < 0.5 && 
                                       Math.abs(item.price * item.quantity - item.total) > 1;

      if (isLikelyBoxes) {
        console.log(`  [InvoiceItem ${item.id}] Normalizing from boxes to pieces.`);
        newQty = item.quantity * factor;
        newPrice = item.price / factor;
        needsUpdate = true;
      } else if (isPriceBoxQuantityPieces) {
        console.log(`  [InvoiceItem ${item.id}] Normalizing price (was box price).`);
        newPrice = item.price / factor;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.invoiceItem.update({
          where: { id: item.id },
          data: { quantity: Math.floor(newQty), price: newPrice }
        });
      }
    }

    // 2. Normalize InventoryLots
    for (const lot of product.lots) {
       let needsUpdate = false;
       let newQty = lot.quantity;
       let newCost = lot.costPrice;
       let newSell = lot.sellingPrice;

       // Similar heuristic for lots: if product has many pieces but lot qty is small
       if (lot.quantity < 50 && lot.costPrice > 10) { 
          // High probability it's in boxes
          newQty = lot.quantity * factor;
          newCost = lot.costPrice / factor;
          newSell = lot.sellingPrice / factor;
          needsUpdate = true;
       }

       if (needsUpdate) {
          console.log(`  [Lot ${lot.id}] Normalizing from boxes to pieces.`);
          await prisma.inventoryLot.update({
             where: { id: lot.id },
             data: { quantity: Math.floor(newQty), costPrice: newCost, sellingPrice: newSell }
          });
       }
    }

    // 3. Normalize Opening Qty
    if (product.openingQty < 100 && product.openingWeightedAvg > 10) {
       console.log(`  [Product ${product.id}] Normalizing opening balance.`);
       await prisma.product.update({
         where: { id: product.id },
         data: {
           openingQty: product.openingQty * factor,
           openingWeightedAvg: product.openingWeightedAvg / factor
         }
       });
    }
  }

  console.log("Normalization Complete!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
