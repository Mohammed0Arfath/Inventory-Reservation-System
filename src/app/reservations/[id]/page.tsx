import { ReservationCheckout } from "@/components/reservation-checkout";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <ReservationCheckout reservationId={id} />
    </main>
  );
}
