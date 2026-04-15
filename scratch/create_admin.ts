import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = "admin";
  const password = "admin123"; // USER: Change this immediately after login
  const name = "المدير العام";

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      password: hashedPassword,
      name,
    },
    create: {
      username,
      password: hashedPassword,
      name,
      role: "ADMIN",
    },
  });

  console.log("Admin user created/updated successfully:");
  console.log("- Username:", username);
  console.log("- Password: admin123 (Please change this!)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
