import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating Raw SQL Healing...');
  try {
    // We use executeRaw to bypass any client-side Int validation
    await prisma.$executeRawUnsafe(`UPDATE "InvoiceItem" SET quantity = 0.9 WHERE id = 2886`);
    await prisma.$executeRawUnsafe(`UPDATE "InvoiceItem" SET quantity = 0.1 WHERE id = 2888`);
    
    console.log('Raw healing completed.');

    // Verify DB values
    const res: any = await prisma.$queryRawUnsafe(`SELECT id, "productId", quantity FROM "InvoiceItem" WHERE id IN (2886, 2888)`);
    console.log('Raw DB Verification:', JSON.stringify(res, null, 2));

    // Verify through the Inventory API (as a separate call)
    console.log('Testing Inventory API response...');
    const inventory = await fetch('http://localhost:3000/api/inventory').then(r => r.json());
    const paragon = inventory.data.find((x: any) => x.id === 7446);
    console.log('API Paragon currentQty:', paragon?.currentQty);

  } catch (error) {
    console.error('Healing Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
