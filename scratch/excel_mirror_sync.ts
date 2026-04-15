import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

async function mirrorExcel() {
  console.log('--- Starting Absolute Excel Mirroring ---');
  
  // 1. Read Excel
  const wb = xlsx.readFile('سيستم الفواتير والمخزون.xlsx');
  const sheet = wb.Sheets['المخزون'];
  const excelData = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Loaded ${excelData.length} items from Excel.`);

  // 2. Sync Products (Opening Balances & Names)
  for (const row of excelData) {
    const name = row['الصنف'];
    const code = Number(row['الكود']);
    const openingQty = Number(row['رصيد اول المدة 1/1/2026']) || 0;
    const openingCost = Number(row['متوسط مرجح 1/1/2026']) || 0;

    if (!name) continue;

    // We find by name or ID (Code)
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: code }, { name: name }] }
    });

    if (product) {
      console.log(`Syncing ${name}: Qty ${openingQty}, Cost ${openingCost}`);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          name: name, // Exact name from Excel
          openingQty: openingQty,
          openingWeightedAvg: openingCost,
          conversionFactor: 1 // Keep factor 1 as user wants no additional units
        }
      });
    }
  }

  // 3. Revert Transaction Normalization (Undo /100 and *100)
  // We look for floats that look like they were normalized (e.g. 0.6, 20.0) 
  // and have prices that look like box prices (e.g. > 10)
  
  const lots = await prisma.inventoryLot.findMany();
  for (const l of lots) {
    // If quantity is small and price is high, it was likely normalized. Revert it.
    if (l.quantity > 0 && l.quantity < 50 && l.costPrice > 10) {
      console.log(`Reverting Lot normalization for Product ID ${l.productId}`);
      await prisma.inventoryLot.update({
        where: { id: l.id },
        data: {
          quantity: l.quantity * 100,
          costPrice: l.costPrice / 100,
          sellingPrice: l.sellingPrice / 100
        }
      });
    }
  }

  const items = await prisma.invoiceItem.findMany();
  for (const i of items) {
    if (i.quantity > 0 && i.quantity < 50 && i.price > 10) {
      console.log(`Reverting InvoiceItem normalization for Product ID ${i.productId}`);
      await prisma.invoiceItem.update({
        where: { id: i.id },
        data: {
          quantity: i.quantity * 100,
          price: i.price / 100,
          costPrice: i.costPrice ? i.costPrice / 100 : null
        }
      });
    }
  }

  console.log('--- Absolute Excel Mirroring Complete ---');
}

mirrorExcel().catch(console.error);
