import { NextResponse } from "next/server";

import { notFound, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ReservationNotFoundError, releaseReservation } from "@/lib/reservations/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reservation = await releaseReservation(prisma, id);

    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return notFound(error.message);
    }

    console.error(error);
    return serverError();
  }
}
