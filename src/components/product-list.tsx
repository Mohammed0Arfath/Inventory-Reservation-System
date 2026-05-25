"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { fetchProducts, fetchWarehouses, reserveInventory } from "@/lib/api";
import { createReservationSchema } from "@/lib/validations/reservations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ProductList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const reserveMutation = useMutation({
    mutationFn: reserveInventory,
    onSuccess: ({ reservation }) => {
      toast.success("Inventory reserved", {
        description: `Reservation ${reservation.id.slice(-6)} created for ${reservation.quantity} unit(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push(`/reservations/${reservation.id}`);
    },
    onError: (error: Error) => {
      const statusText = error.message.toLowerCase();
      if (statusText.includes("insufficient") || statusText.includes("conflict")) {
        toast.error("Unable to reserve inventory", {
          description: "Stock was reserved by another checkout. Please refresh and try a different warehouse.",
        });
        return;
      }

      toast.error("Reservation failed", {
        description: error.message,
      });
    },
  });

  const warehouseCount = useMemo(() => warehousesQuery.data?.warehouses.length ?? 0, [warehousesQuery.data]);

  if (productsQuery.isLoading || warehousesQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading inventory...
      </div>
    );
  }

  if (productsQuery.isError) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Failed to load products</CardTitle>
          <CardDescription>{(productsQuery.error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (warehousesQuery.isError) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Failed to load warehouses</CardTitle>
          <CardDescription>{(warehousesQuery.error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-cyan-600 via-sky-700 to-blue-800 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Inventory Reservations</CardTitle>
          <CardDescription className="text-slate-100">
            {warehouseCount} warehouses available. Reservations auto-expire in 10 minutes.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {productsQuery.data?.products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>SKU: {product.sku}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.inventory.map((item) => {
                    const key = `${product.id}:${item.warehouseId}`;
                    const quantity = quantities[key] ?? 1;
                    const outOfStock = item.availableUnits <= 0;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.warehouseName}</div>
                          <div className="text-xs text-slate-500">{item.location}</div>
                        </TableCell>
                        <TableCell>{item.availableUnits}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={Math.max(item.availableUnits, 1)}
                            value={quantity}
                            onChange={(event) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [key]: Number(event.target.value) || 1,
                              }))
                            }
                            className="w-20"
                            disabled={outOfStock || reserveMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={outOfStock || reserveMutation.isPending || quantity > item.availableUnits}
                            onClick={() =>
                              (() => {
                                const parsed = createReservationSchema.safeParse({
                                  productId: product.id,
                                  warehouseId: item.warehouseId,
                                  quantity,
                                });

                                if (!parsed.success) {
                                  toast.error("Invalid quantity", {
                                    description: "Quantity must be a whole number between 1 and 100.",
                                  });
                                  return;
                                }

                                reserveMutation.mutate(parsed.data);
                              })()
                            }
                          >
                            Reserve
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
