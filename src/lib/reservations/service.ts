import { Prisma, PrismaClient } from "@prisma/client";

import { ReservationStatus } from "@/types/inventory";

export const RESERVATION_TTL_MINUTES = 10;

const RESERVATION_TTL_MS = RESERVATION_TTL_MINUTES * 60 * 1000;

type TransactionClient = Prisma.TransactionClient;

type LockedInventoryRow = {
  id: string;
  totalUnits: number;
  reservedUnits: number;
};

type LockedReservationRow = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
};

export class ReservationNotFoundError extends Error {}
export class InventoryNotFoundError extends Error {}
export class InsufficientInventoryError extends Error {}
export class ReservationExpiredError extends Error {}
export class ReservationConflictError extends Error {}

function getExpiryDate() {
  return new Date(Date.now() + RESERVATION_TTL_MS);
}

async function lockInventory(
  tx: TransactionClient,
  productId: string,
  warehouseId: string,
): Promise<LockedInventoryRow> {
  const rows = (await tx.$queryRaw`
    SELECT id, "totalUnits", "reservedUnits"
    FROM "Inventory"
    WHERE "productId" = ${productId}
      AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `) as LockedInventoryRow[];

  const inventory = rows[0];
  if (!inventory) {
    throw new InventoryNotFoundError("Inventory row not found");
  }

  return inventory;
}

async function lockReservationById(tx: TransactionClient, reservationId: string): Promise<LockedReservationRow> {
  const rows = (await tx.$queryRaw`
    SELECT id, "productId", "warehouseId", quantity, status, "expiresAt"
    FROM "Reservation"
    WHERE id = ${reservationId}
    FOR UPDATE
  `) as LockedReservationRow[];

  const reservation = rows[0];
  if (!reservation) {
    throw new ReservationNotFoundError("Reservation not found");
  }

  return reservation;
}

async function releasePendingReservation(
  tx: TransactionClient,
  reservation: Pick<LockedReservationRow, "id" | "productId" | "warehouseId" | "quantity">,
) {
  const inventory = await lockInventory(tx, reservation.productId, reservation.warehouseId);

  if (inventory.reservedUnits < reservation.quantity) {
    throw new ReservationConflictError("Reserved units are lower than reservation quantity");
  }

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      reservedUnits: {
        decrement: reservation.quantity,
      },
    },
  });

  return tx.reservation.update({
    where: { id: reservation.id },
    data: {
      status: ReservationStatus.RELEASED,
    },
  });
}

export async function createReservation(
  prisma: PrismaClient,
  input: {
    productId: string;
    warehouseId: string;
    quantity: number;
    idempotencyKey?: string;
  },
) {
  return prisma.$transaction(
    async (tx: TransactionClient) => {
      if (input.idempotencyKey) {
        const existing = await tx.reservation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          if (
            existing.productId !== input.productId ||
            existing.warehouseId !== input.warehouseId ||
            existing.quantity !== input.quantity
          ) {
            throw new ReservationConflictError("Idempotency key was already used with a different payload");
          }

          return existing;
        }
      }

      const inventory = await lockInventory(tx, input.productId, input.warehouseId);
      const available = inventory.totalUnits - inventory.reservedUnits;

      if (available < input.quantity) {
        throw new InsufficientInventoryError("Insufficient inventory");
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedUnits: {
            increment: input.quantity,
          },
        },
      });

      return tx.reservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          status: ReservationStatus.PENDING,
          expiresAt: getExpiryDate(),
          idempotencyKey: input.idempotencyKey,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function confirmReservation(
  prisma: PrismaClient,
  reservationId: string,
) {
  return prisma.$transaction(
    async (tx: TransactionClient) => {
      const reservation = await lockReservationById(tx, reservationId);

      if (reservation.status === ReservationStatus.CONFIRMED) {
        return tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
      }

      if (reservation.status === ReservationStatus.RELEASED) {
        throw new ReservationConflictError("Reservation already released");
      }

      if (reservation.expiresAt <= new Date()) {
        await releasePendingReservation(tx, reservation);
        throw new ReservationExpiredError("Reservation expired");
      }

      const inventory = await lockInventory(tx, reservation.productId, reservation.warehouseId);

      if (inventory.reservedUnits < reservation.quantity || inventory.totalUnits < reservation.quantity) {
        throw new ReservationConflictError("Inventory state conflict during confirmation");
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalUnits: {
            decrement: reservation.quantity,
          },
          reservedUnits: {
            decrement: reservation.quantity,
          },
        },
      });

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CONFIRMED,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function releaseReservation(prisma: PrismaClient, reservationId: string) {
  return prisma.$transaction(
    async (tx: TransactionClient) => {
      const reservation = await lockReservationById(tx, reservationId);

      if (reservation.status === ReservationStatus.RELEASED) {
        return tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
      }

      if (reservation.status === ReservationStatus.CONFIRMED) {
        return tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
      }

      return releasePendingReservation(tx, reservation);
    },
    { isolationLevel: "Serializable" },
  );
}

export async function releaseExpiredReservations(prisma: PrismaClient) {
  return prisma.$transaction(
    async (tx: TransactionClient) => {
      const expired = (await tx.$queryRaw`
        SELECT id, "productId", "warehouseId", quantity, status, "expiresAt"
        FROM "Reservation"
        WHERE status = 'PENDING'::"ReservationStatus"
          AND "expiresAt" < NOW()
        FOR UPDATE SKIP LOCKED
      `) as LockedReservationRow[];

      let released = 0;

      for (const reservation of expired) {
        await releasePendingReservation(tx, reservation);
        released += 1;
      }

      return { released };
    },
    { isolationLevel: "Serializable" },
  );
}
