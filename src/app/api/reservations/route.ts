import { NextResponse } from "next/server";

import { conflict, fromZodError, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  InventoryNotFoundError,
  InsufficientInventoryError,
  ReservationConflictError,
  createReservation,
} from "@/lib/reservations/service";
import { createReservationSchema } from "@/lib/validations/reservations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return fromZodError(parsed.error);
    }

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

    const reservation = await createReservation(prisma, {
      ...parsed.data,
      idempotencyKey,
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (
      error instanceof InsufficientInventoryError ||
      error instanceof ReservationConflictError ||
      error instanceof InventoryNotFoundError
    ) {
      return conflict(error.message);
    }

    console.error(error);
    return serverError();
  }
}
