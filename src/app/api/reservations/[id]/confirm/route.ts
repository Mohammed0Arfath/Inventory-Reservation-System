import { NextResponse } from "next/server";

import { conflict, gone, notFound, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  ReservationConflictError,
  ReservationExpiredError,
  ReservationNotFoundError,
  confirmReservation,
} from "@/lib/reservations/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reservation = await confirmReservation(prisma, id);

    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return notFound(error.message);
    }

    if (error instanceof ReservationExpiredError) {
      return gone(error.message);
    }

    if (error instanceof ReservationConflictError) {
      return conflict(error.message);
    }

    console.error(error);
    return serverError();
  }
}
