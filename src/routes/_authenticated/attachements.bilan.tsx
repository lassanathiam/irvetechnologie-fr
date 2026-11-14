import { createFileRoute, redirect } from "@tanstack/react-router";

// Le bilan est remplacé par la page unique « Suivi chantiers ».
export const Route = createFileRoute("/_authenticated/attachements/bilan")({
  beforeLoad: () => { throw redirect({ to: "/suivi", search: { etape: 3 } }); },
});
