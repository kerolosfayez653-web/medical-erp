import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function wipeDatabase() {
  console.log('--- Wiping Database ---');
  
  // Order matters due to FKs
  await prisma.invoiceItem.deleteMany();
  await prisma.invoiceLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.inventoryLot.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.person.deleteMany();
  await prisma.product.deleteMany();
  await prisma.expense.deleteMany();

  console.log('--- Database Wiped Successfully ---');
}

wipeDatabase()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
