import { z } from "zod";

// ─── Request schemas ───────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ─── Response types ────────────────────────────────────────────────────────

export type WarehouseDTO = {
  id: string;
  name: string;
  city: string;
  address: string | null;
};

export type StockDTO = {
  warehouseId: string;
  warehouseName: string;
  warehouseCity: string;
  total: number;
  reserved: number;
  available: number;
};

export type ProductDTO = {
  id: string;
  name: string;
  description: string | null;
  price: string; // Decimal serialised as string to avoid JSON precision issues
  category: string | null;
  imageUrl: string | null;
  stocks: StockDTO[];
};

export type ReservationDTO = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string; // ISO string
  createdAt: string;
  product: {
    id: string;
    name: string;
    price: string;
    category: string | null;
    description: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    city: string;
  };
};

// ─── API error response ────────────────────────────────────────────────────

export type ApiError = {
  error: string;
  code?: string;
};
