import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { InterventionsMap } from "@/components/InterventionsMap";

export const Route = createFileRoute("/zz-test-carte")({
  component: () => (
    <div className="pro-main dark">
      <ClientOnly>
        <InterventionsMap
          markers={[
            { id: "a", lat: 47.2, lng: -1.55, label: "Test A", couleur: "#0284c7", statut: "planifie" } as never,
            { id: "b", lat: 46.8, lng: -1.9, label: "Test B", statut: "confirme" } as never,
          ]}
        />
      </ClientOnly>
    </div>
  ),
});
