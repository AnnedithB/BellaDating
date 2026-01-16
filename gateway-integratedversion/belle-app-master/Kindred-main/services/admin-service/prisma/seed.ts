import { PrismaClient, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});
// Also load from project root if present
dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  "users.read",
  "users.moderate",
  "tickets.read",
  "tickets.manage",
  "knowledge-base.manage",
  "analytics.view",
  "settings.write",
];

async function seedAdmin() {
  const email =
    process.env.ADMIN_SEED_EMAIL ?? "ogollachucho@gmail.com";
  const password =
    process.env.ADMIN_SEED_PASSWORD ?? "123456789";
  const firstName =
    process.env.ADMIN_SEED_FIRST_NAME ?? "Ogolla";
  const lastName =
    process.env.ADMIN_SEED_LAST_NAME ?? "Chucho";

  const role =
    (process.env.ADMIN_SEED_ROLE as AdminRole | undefined) ??
    AdminRole.SUPER_ADMIN;

  const bcryptRounds = parseInt(
    process.env.BCRYPT_ROUNDS ?? "12",
    10
  );

  if (!email || !password) {
    throw new Error(
      "Both ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be provided."
    );
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);

  // Ensure permissions exist
  await Promise.all(
    DEFAULT_PERMISSIONS.map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: {},
        create: {
          name,
          description: `${name} permission`,
          category: "system",
        },
      })
    )
  );

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      role,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      isActive: true,
    },
  });

  // Link permissions
  const permissions = await prisma.permission.findMany({
    where: { name: { in: DEFAULT_PERMISSIONS } },
  });

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      permissions: {
        set: [],
        connect: permissions.map((permission) => ({
          id: permission.id,
        })),
      },
    },
  });

  return admin;
}

async function main() {
  const admin = await seedAdmin();

  console.log(`Admin account ready for ${admin.email}`);
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
