import type { ReactElement } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatInterval, type Booking } from "@/lib/bookings";

// The one confirmation every Cancel goes through, whichever control opens it.
export function CancelBookingDialog({
  booking: b,
  onCancel,
  trigger,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  trigger: ReactElement;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel booking {b.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            {b.resource.id} {formatInterval(b.start, b.end)} becomes free. The id {b.id} stays taken.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          {/* A Close, so the dialog shuts as the cancel starts. */}
          <AlertDialogCancel variant="destructive" onClick={() => onCancel(b.id)}>
            Cancel booking
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
