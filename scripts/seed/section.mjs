// Prints the named parts of supabase/seed.sql (the "-- @section name" blocks
// build.mjs writes) wrapped in one transaction, so a single part can be loaded
// into a database without re-running the whole seed.
//
//   node scripts/seed/section.mjs classroom_meetings printers > part.sql
//   node scripts/seed/section.mjs all > part.sql
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const seed = await readFile(join(HERE, "..", "..", "supabase", "seed.sql"), "utf8");

const parts = new Map();
let current = null;
for (const line of seed.split("\n")) {
  const marker = line.match(/^-- @section (\w+)$/);
  if (marker) {
    current = marker[1];
    parts.set(current, []);
  } else if (line === "commit;") {
    current = null;
  } else if (current) {
    parts.get(current).push(line);
  }
}

const wanted = process.argv.slice(2);
if (wanted.length === 0) {
  console.error(`Name one or more sections, or "all": ${[...parts.keys()].join(", ")}`);
  process.exit(1);
}
const names = wanted.includes("all") ? [...parts.keys()] : wanted;
for (const name of names) {
  if (!parts.has(name)) {
    console.error(`No section "${name}" in seed.sql. Sections: ${[...parts.keys()].join(", ")}`);
    process.exit(1);
  }
}

process.stdout.write(
  ["begin;", ...names.flatMap((name) => [`-- @section ${name}`, ...parts.get(name)]), "commit;", ""].join("\n"),
);
