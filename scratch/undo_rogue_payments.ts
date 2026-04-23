import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function undoPayments() {
  const deleted = await prisma.payment.deleteMany({
    where: { notes: { contains: 'تسوية آلية' } }
  });
  console.log('Undid rogue payments:', deleted.count);
}

undoPayments().catch(console.error).finally(()=>prisma.$disconnect());
