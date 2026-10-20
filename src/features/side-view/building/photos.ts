export function photoFileUrl(supabaseUrl: string, pathPrefix: string, width: number): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${pathPrefix}-${width}.webp`;
}

export function photoSources(supabaseUrl: string, pathPrefix: string, widths: readonly number[]): { src: string; srcSet: string } {
  const ordered = [...widths].filter((width) => width > 0).sort((a, b) => a - b);
  const largest = ordered[ordered.length - 1] ?? widths[0] ?? 960;
  return {
    src: photoFileUrl(supabaseUrl, pathPrefix, largest),
    srcSet: ordered.map((width) => `${photoFileUrl(supabaseUrl, pathPrefix, width)} ${width}w`).join(", "),
  };
}
