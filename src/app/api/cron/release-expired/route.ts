import { NextResponse } from "next/server";

import { serverError, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations/service";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return unauthorized("Unauthorized");
  }

  try {
    const result = await releaseExpiredReservations(prisma);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    return serverError();
  }
}
