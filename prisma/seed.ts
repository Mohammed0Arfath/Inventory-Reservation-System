import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const [w1, w2] = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "East Coast Fulfillment",
        location: "New Jersey",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "West Coast Fulfillment",
        location: "California",
      },
    }),
  ]);

  const [p1, p2, p3] = await Promise.all([
    prisma.product.create({
      data: {
        name: "Aero Running Shoes",
        sku: "ARS-1001",
      },
    }),
    prisma.product.create({
      data: {
        name: "Luma Backpack",
        sku: "LBP-2042",
      },
    }),
    prisma.product.create({
      data: {
        name: "Thermal Flask 1L",
        sku: "TFL-3300",
      },
    }),
  ]);

  await prisma.inventory.createMany({
    data: [
      { productId: p1.id, warehouseId: w1.id, totalUnits: 25, reservedUnits: 0 },
      { productId: p1.id, warehouseId: w2.id, totalUnits: 20, reservedUnits: 0 },
      { productId: p2.id, warehouseId: w1.id, totalUnits: 18, reservedUnits: 0 },
      { productId: p2.id, warehouseId: w2.id, totalUnits: 12, reservedUnits: 0 },
      { productId: p3.id, warehouseId: w1.id, totalUnits: 40, reservedUnits: 0 },
      { productId: p3.id, warehouseId: w2.id, totalUnits: 35, reservedUnits: 0 },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
