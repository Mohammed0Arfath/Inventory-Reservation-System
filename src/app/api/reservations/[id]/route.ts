import { NextResponse } from "next/server";

import { notFound, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return notFound("Reservation not found");
    }

    return NextResponse.json({ reservation });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
