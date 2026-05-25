import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/http";

type ProductInventoryRow = {
  id: string;
  warehouseId: string;
  warehouse: {
    name: string;
    location: string;
  };
  totalUnits: number;
  reservedUnits: number;
};

type ProductWithInventory = {
  id: string;
  name: string;
  sku: string;
  createdAt: Date;
  inventory: ProductInventoryRow[];
};

export async function GET() {
  try {
    const products = (await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        inventory: {
          include: {
            warehouse: true,
          },
        },
      },
    })) as ProductWithInventory[];

    const payload = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      createdAt: product.createdAt,
      inventory: product.inventory.map((inventory) => ({
        id: inventory.id,
        warehouseId: inventory.warehouseId,
        warehouseName: inventory.warehouse.name,
        location: inventory.warehouse.location,
        totalUnits: inventory.totalUnits,
        reservedUnits: inventory.reservedUnits,
        availableUnits: inventory.totalUnits - inventory.reservedUnits,
      })),
    }));

    return NextResponse.json({ products: payload });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
