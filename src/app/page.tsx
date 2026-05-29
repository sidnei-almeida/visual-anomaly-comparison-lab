import { ApiGate } from "@/components/gate/ApiGate";
import { AppShell } from "@/components/layout/AppShell";

export default function HomePage() {
  return (
    <ApiGate>
      <AppShell />
    </ApiGate>
  );
}
