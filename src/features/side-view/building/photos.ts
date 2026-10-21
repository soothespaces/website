import { photoUrl } from "@/features/admin-photos/photo";

export function photoSources(supabaseUrl: string, pathPrefix: string, widths: readonly number[]): { src: string; srcSet: string } {
  const base = supabaseUrl.replace(/\/$/, "");
  const ordered = [...widths].filter((width) => width > 0).sort((a, b) => a - b);
  const largest = ordered[ordered.length - 1] ?? widths[0] ?? 960;
  return {
    src: photoUrl(base, pathPrefix, largest),
    srcSet: ordered.map((width) => `${photoUrl(base, pathPrefix, width)} ${width}w`).join(", "),
  };
}
