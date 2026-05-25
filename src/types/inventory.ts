export const ReservationStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  RELEASED: "RELEASED",
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export type ProductInventoryView = {
  id: string;
  name: string;
  sku: string;
  createdAt: string;
  inventory: {
    id: string;
    warehouseId: string;
    warehouseName: string;
    location: string;
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }[];
};

export type WarehouseView = {
  id: string;
  name: string;
  location: string;
  createdAt: string;
};

export type ReservationView = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
};
