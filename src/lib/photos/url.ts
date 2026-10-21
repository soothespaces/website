// Public URL of one pre-resized WebP. `pathPrefix` is the storage key
// without the width, such as photos/buildings/shapiro/<id>.

export function photoUrl(supabaseUrl: string, pathPrefix: string, width: number): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const prefix = pathPrefix.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${prefix}-${width}.webp`;
}
