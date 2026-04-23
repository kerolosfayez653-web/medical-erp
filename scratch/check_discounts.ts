import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.invoice.findFirst({where:{discount:{gt:0}}});
  console.log("Invoice with discount:", inv);

  const inv2 = await prisma.invoice.findFirst({where:{deliveryFee:{gt:0}}});
  console.log("Invoice with delivery:", inv2);

  const payments = await prisma.payment.findMany();
  console.log("Total payments:", payments.length);
  
  if (payments.length > 0) {
    console.log("First 5 Payments:");
    console.table(payments.slice(0, 5));
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
