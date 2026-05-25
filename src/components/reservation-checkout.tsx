"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmReservation, fetchReservation, releaseReservation } from "@/lib/api";
import { useCountdown } from "@/hooks/use-countdown";
import { ReservationStatus } from "@/types/inventory";

export function ReservationCheckout({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();

  const reservationQuery = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => fetchReservation(reservationId),
    refetchInterval: 1000,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmReservation(reservationId),
    onSuccess: () => {
      toast.success("Reservation confirmed", {
        description: "Inventory has been finalized and stock was decremented.",
      });
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
    },
    onError: (error: Error) => {
      const msg = error.message.toLowerCase();
      if (msg.includes("expired")) {
        toast.error("Reservation expired", {
          description: "This reservation expired before confirmation.",
        });
        queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
        return;
      }

      toast.error("Unable to confirm", {
        description: error.message,
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseReservation(reservationId),
    onSuccess: () => {
      toast.success("Reservation released", {
        description: "Reserved stock is now available to other shoppers.",
      });
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
    },
    onError: (error: Error) => {
      toast.error("Unable to release", {
        description: error.message,
      });
    },
  });

  const reservation = reservationQuery.data?.reservation;
  const expiresAt = reservation?.expiresAt ?? new Date().toISOString();
  const countdown = useCountdown(expiresAt, reservation?.status === ReservationStatus.PENDING);

  const badgeVariant = useMemo(() => {
    switch (reservation?.status) {
      case ReservationStatus.CONFIRMED:
        return "success" as const;
      case ReservationStatus.RELEASED:
        return "destructive" as const;
      default:
        return countdown.expired ? ("warning" as const) : ("secondary" as const);
    }
  }, [countdown.expired, reservation?.status]);

  if (reservationQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading reservation...
      </div>
    );
  }

  if (reservationQuery.isError || !reservation) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Reservation not available</CardTitle>
          <CardDescription>{(reservationQuery.error as Error)?.message || "Reservation not found"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to products
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isPending = reservation.status === ReservationStatus.PENDING;
  const isExpired = countdown.expired && isPending;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-slate-900">
        <CardHeader>
          <CardTitle className="text-2xl">Checkout Reservation</CardTitle>
          <CardDescription className="text-slate-900/80">
            Payment window closes automatically after the reservation expires.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{reservation.product.name}</CardTitle>
              <CardDescription>
                SKU {reservation.product.sku} • {reservation.warehouse.name} ({reservation.warehouse.location})
              </CardDescription>
            </div>
            <Badge variant={badgeVariant}>{isExpired ? "EXPIRED" : reservation.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Reservation ID</div>
              <div className="font-mono text-sm text-slate-900">{reservation.id}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Quantity</div>
              <div className="text-xl font-semibold text-slate-900">{reservation.quantity}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock3 className="h-4 w-4" />
              Time remaining
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{countdown.label}</div>
            <div className="mt-1 text-xs text-slate-500">Expires at {new Date(reservation.expiresAt).toLocaleString()}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={!isPending || isExpired || confirmMutation.isPending || releaseMutation.isPending}
            >
              {confirmMutation.isPending ? "Confirming..." : "Confirm reservation"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => releaseMutation.mutate()}
              disabled={!isPending || releaseMutation.isPending || confirmMutation.isPending}
            >
              {releaseMutation.isPending ? "Releasing..." : "Cancel reservation"}
            </Button>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to products
            </Link>
          </div>

          {isExpired ? (
            <p className="text-sm text-amber-700">
              Reservation has expired. It will be released automatically, or you can trigger release by pressing cancel.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
