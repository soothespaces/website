import { canAdminFloors } from "@/features/floor-alignment/access";
import { findSheet } from "@/features/floor-alignment/floors";

// MPrint serves its sheets without CORS headers, and the map draws the
// sheet as a WebGL texture, which needs them. This passes the PNG through
// from our origin. Only sheets in public/floor-plans/index.json are served.
export async function GET(_request: Request, ctx: RouteContext<"/admin/floors/sheets/[sheet]">) {
  const { sheet } = await ctx.params;
  const record = findSheet(sheet);
  if (!record) return new Response("Unknown sheet", { status: 404 });
  if (!(await canAdminFloors())) return new Response("Sign in first", { status: 401 });

  const tag = sheet.slice(0, sheet.lastIndexOf("_"));
  const upstream = await fetch(`https://mprint.umich.edu/assets/floorplans/${tag}/${sheet}.png`, {
    next: { revalidate: 86400 },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(`MPrint returned ${upstream.status}`, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
