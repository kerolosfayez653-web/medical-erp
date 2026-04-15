import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Final Paragon Movement Recovery...');
  try {
    // Item 2886: 90 Pieces @ 15 EGP
    await prisma.invoiceItem.update({
      where: { id: 2886 },
      data: {
        quantity: 90,
        unitType: 'SECONDARY',
        price: 15,
        totalNet: 1350
      }
    });

    // Item 2888: 10 Pieces @ 15 EGP
    await prisma.invoiceItem.update({
      where: { id: 2888 },
      data: {
        quantity: 10,
        unitType: 'SECONDARY',
        price: 15,
        totalNet: 150
      }
    });

    console.log('Successfully converted boxes to pieces.');

    const res = await fetch('http://localhost:3000/api/inventory').then(r => r.json());
    const p = res.data.find((x: any) => x.id === 7446);
    console.log('RE-VERIFIED PARAGON STOCK (Pieces):', p?.currentQty);
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
