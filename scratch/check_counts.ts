import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
    console.log('Products:', await prisma.product.count());
    console.log('People:', await prisma.person.count());
    console.log('Invoices:', await prisma.invoice.count());
}
check().finally(() => prisma.$disconnect());
