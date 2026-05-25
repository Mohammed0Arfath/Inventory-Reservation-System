import { z } from "zod";

export const createReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export const reservationParamsSchema = z.object({
  id: z.string().min(1),
});

export const releaseExpiredAuthSchema = z.object({
  authorization: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
