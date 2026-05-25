import { ProductInventoryView, ReservationView, WarehouseView } from "@/types/inventory";

type ApiError = {
  error: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const error = body as ApiError;
    throw new Error(error.error || "Request failed");
  }

  return body as T;
}

export async function fetchProducts() {
  const response = await fetch("/api/products", { cache: "no-store" });
  return parseJson<{ products: ProductInventoryView[] }>(response);
}

export async function fetchWarehouses() {
  const response = await fetch("/api/warehouses", { cache: "no-store" });
  return parseJson<{ warehouses: WarehouseView[] }>(response);
}

export async function reserveInventory(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  idempotencyKey?: string;
}) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey;
  }

  const response = await fetch("/api/reservations", {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
    }),
  });

  return parseJson<{ reservation: ReservationView }>(response);
}

export async function fetchReservation(id: string) {
  const response = await fetch(`/api/reservations/${id}`, { cache: "no-store" });
  return parseJson<{ reservation: ReservationView }>(response);
}

export async function confirmReservation(id: string) {
  const response = await fetch(`/api/reservations/${id}/confirm`, {
    method: "POST",
  });

  return parseJson<{ reservation: ReservationView }>(response);
}

export async function releaseReservation(id: string) {
  const response = await fetch(`/api/reservations/${id}/release`, {
    method: "POST",
  });

  return parseJson<{ reservation: ReservationView }>(response);
}
