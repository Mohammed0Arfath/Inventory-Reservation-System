import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/http";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ warehouses });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
