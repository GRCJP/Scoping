import { redirect } from "next/navigation";

/** Public product URL is /intake only. Root is not a second site. */
export default function HomePage() {
  redirect("/intake");
}
