import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
      <Button>New booking</Button>
    </main>
  );
}
