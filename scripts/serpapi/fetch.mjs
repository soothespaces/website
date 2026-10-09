// Looks up each building in targets.json on Google Maps through SerpApi
// (https://serpapi.com/google-maps-api) and saves what comes back, so the
// seed can be built from files and no search is ever paid for twice.
//
//   SERPAPI_API_KEY=… node scripts/serpapi/fetch.mjs
//
// How many searches a run may spend, and on which buildings, comes from
// plan.json ({ "max": 10, "only": ["slug", …] }). The free plan has 250
// searches a month and 50 an hour, so:
// - The Account API (free) is read first; the run never spends more than
//   plan.max, the searches left this month, or the searches left this hour.
// - A building with a file in raw/places/ or raw/unresolved/ is skipped.
//   Delete its file to look it up again.
// - Every call counts as spent, errors included, and nothing is retried.
//
// Each building costs one search when Google opens the place straight away
// (place_results), or two when it lists candidates (local_results): then the
// nearest candidate within MATCH_RADIUS_M of our coordinates is fetched by
// place_id. With no such candidate, the building goes to raw/unresolved/
// with the candidates, for a person to pick.
//
// Written per building:
//   raw/responses/<slug>.<n>.json  each full response, minus reviewer
//                                  names and photos, with the key redacted
//   raw/places/<slug>.json         the resolved place_results and how
//   raw/unresolved/<slug>.json     candidates when nothing matched
//   raw/ledger.json                one entry per search, for the budget
// SerpApi keeps every search for 31 days: search_metadata.json_endpoint
// (with the key) returns the unedited response for free.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, "raw");
const KEY = process.env.SERPAPI_API_KEY;
const MATCH_RADIUS_M = 150;
const COMMON = { engine: "google_maps", hl: "en", gl: "us" };

if (!KEY) {
  console.error("SERPAPI_API_KEY isn't set. Nothing was fetched.");
  process.exit(1);
}

const { targets } = JSON.parse(await readFile(join(HERE, "targets.json"), "utf8"));
const plan = JSON.parse(await readFile(join(HERE, "plan.json"), "utf8"));
for (const dir of ["responses", "places", "unresolved"]) await mkdir(join(RAW, dir), { recursive: true });
const ledgerPath = join(RAW, "ledger.json");
const ledger = existsSync(ledgerPath) ? JSON.parse(await readFile(ledgerPath, "utf8")) : [];

const redact = (text) => text.split(KEY).join("[redacted]");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reviewer identities stay out of the repo (docs/technical/data-sources.md
// § 11): any object with a username loses it and the fields that point back
// to the person.
const IDENTITY = ["username", "contributor_id", "user_thumbnail", "user_review_count", "user_photo_count", "link", "images"];
// Review summaries carry the reviewer's avatar as their thumbnail.
function scrub(value, inReviews = false) {
  if (Array.isArray(value)) return value.map((v) => scrub(v, inReviews));
  if (value && typeof value === "object") {
    const out = {};
    const person = "username" in value;
    for (const [k, v] of Object.entries(value)) {
      if (person && IDENTITY.includes(k)) continue;
      if (inReviews && k === "thumbnail") continue;
      out[k] = scrub(v, inReviews || k === "user_reviews");
    }
    return out;
  }
  return value;
}

const write = (path, data) => writeFile(path, redact(JSON.stringify(data, null, 2)) + "\n");

// Free: doesn't count toward the quota.
async function account() {
  const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(KEY)}`);
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Account API: ${res.status} ${redact(JSON.stringify(body.error ?? body))}`);
  return body;
}

let spent = 0;
let budget = 0;

async function search(slug, params) {
  if (spent >= budget) throw new Error("budget");
  spent += 1;
  const n = ledger.filter((entry) => entry.slug === slug).length + 1;
  const url = `https://serpapi.com/search.json?${new URLSearchParams({ ...COMMON, ...params, api_key: KEY })}`;
  let body;
  let status;
  try {
    const res = await fetch(url);
    status = res.status;
    body = await res.json();
  } catch (error) {
    body = { error: `fetch failed: ${error.message}` };
  }
  const meta = body.search_metadata ?? {};
  ledger.push({
    at: new Date().toISOString(),
    slug,
    params,
    http_status: status ?? null,
    search_id: meta.id ?? null,
    status: meta.status ?? null,
    error: body.error ?? null,
    file: `responses/${slug}.${n}.json`,
  });
  await write(join(RAW, "responses", `${slug}.${n}.json`), scrub(body));
  await write(ledgerPath, ledger);
  await pause(1500);
  if (body.error && /api key|plan|run out|limit/i.test(body.error)) {
    throw new Error(`SerpApi refused the search: ${redact(body.error)}`);
  }
  return body;
}

// Metres between two points (equirectangular is plenty at campus scale).
function distance(lat1, lng1, lat2, lng2) {
  const x = ((lng2 - lng1) * Math.PI * 6371000 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))) / 180;
  const y = ((lat2 - lat1) * Math.PI * 6371000) / 180;
  return Math.round(Math.hypot(x, y));
}

const info = await account();
console.log(
  `Account: ${info.plan_name}; ${info.plan_searches_left} plan searches left this month ` +
    `(${info.total_searches_left} in total); ${info.this_hour_searches}/${info.account_rate_limit_per_hour} used this hour.`,
);
budget = Math.min(
  plan.max ?? 0,
  info.total_searches_left ?? 0,
  (info.account_rate_limit_per_hour ?? 0) - (info.this_hour_searches ?? 0),
);
console.log(`This run may spend up to ${budget} searches (plan.json max ${plan.max}).`);

// plan.inspect: saved responses (e.g. "shapiro.2.json") whose raw Google HTML
// should be checked for popular times SerpApi's parser may have missed.
// SerpApi keeps that HTML for 31 days, and fetching it is free. The HTML
// carries reviewer names, so only marker counts and the matched busyness
// phrases are written, to raw/inspect/.
const BUSY = /(Usually not (?:too )?busy|Not (?:too )?busy|Usually a little busy|A little busy|Usually as busy as it gets|As busy as it gets|Usually (?:not too |a little )?busy|Busier than usual|Less busy than usual|Now: [^"\\]{0,40})/g;
for (const file of plan.inspect ?? []) {
  const saved = JSON.parse(await readFile(join(RAW, "responses", file), "utf8"));
  const url = saved.search_metadata?.raw_html_file;
  if (!url) {
    console.log(`${file}: no raw_html_file`);
    continue;
  }
  const res = await fetch(`${url}?api_key=${encodeURIComponent(KEY)}`);
  const html = await res.text();
  const phrases = [...new Set(html.match(BUSY) ?? [])];
  const report = {
    file,
    search_id: saved.search_metadata.id,
    http_status: res.status,
    bytes: html.length,
    popular_times_heading: (html.match(/Popular times/g) ?? []).length,
    live: (html.match(/\bLive\b|LIVE/g) ?? []).length,
    percent_busy: (html.match(/\d{1,3}% busy/g) ?? []).length,
    busyness_phrases: phrases.slice(0, 20),
    checked_at: new Date().toISOString(),
  };
  await mkdir(join(RAW, "inspect"), { recursive: true });
  await write(join(RAW, "inspect", file), report);
  console.log(`${file}: ${JSON.stringify(report)}`);
}

// plan.place_id_lookup: buildings already saved from a search whose place
// should be fetched again by place_id (Google's place view can carry more,
// like popular times, than the place a search opens).
const followups = targets.filter((t) => {
  if (!plan.place_id_lookup?.includes(t.slug)) return false;
  const path = join(RAW, "places", `${t.slug}.json`);
  return existsSync(path);
});

const todo = targets.filter(
  (t) =>
    (!plan.only?.length || plan.only.includes(t.slug)) &&
    !existsSync(join(RAW, "places", `${t.slug}.json`)) &&
    !existsSync(join(RAW, "unresolved", `${t.slug}.json`)),
);
console.log(`${todo.length} buildings to look up.`);

try {
  for (const target of followups) {
    const path = join(RAW, "places", `${target.slug}.json`);
    const saved = JSON.parse(await readFile(path, "utf8"));
    if (saved.resolved_by?.startsWith("place_id lookup")) continue;
    const body = await search(target.slug, { place_id: saved.place.place_id });
    if (!body.place_results) {
      console.log(`${target.slug}: place_id lookup returned no place (${body.error ?? "no place_results"}); kept the saved one.`);
      continue;
    }
    const days = Object.keys(body.place_results.popular_times?.graph_results ?? {}).length;
    await write(path, {
      ...saved,
      fetched_at: new Date().toISOString(),
      search_ids: [...saved.search_ids, body.search_metadata?.id ?? null],
      resolved_by: `place_id lookup after: ${saved.resolved_by}`,
      place: scrub(body.place_results),
    });
    console.log(`${target.slug}: refetched by place_id, ${days ? `popular times for ${days} days` : "no popular times"}`);
  }

  for (const target of todo) {
    // Never start a building that couldn't be finished if Google lists
    // candidates instead of opening the place.
    if (budget - spent < 2) {
      console.log(`Stopping with ${budget - spent} search left: a building can take two.`);
      break;
    }
    const searchIds = [];
    const first = await search(target.slug, {
      type: "search",
      q: target.query,
      ll: `@${target.lat},${target.lng},17z`,
    });
    searchIds.push(first.search_metadata?.id ?? null);

    let place = first.place_results;
    let resolvedBy = place ? "search opened the place" : null;
    if (!place && first.local_results?.length) {
      const candidates = first.local_results
        .filter((r) => r.gps_coordinates)
        .map((r) => ({
          title: r.title,
          place_id: r.place_id,
          type: r.type,
          address: r.address,
          distance_m: distance(target.lat, target.lng, r.gps_coordinates.latitude, r.gps_coordinates.longitude),
        }))
        .sort((a, b) => a.distance_m - b.distance_m);
      const best = candidates.find((c) => c.distance_m <= MATCH_RADIUS_M && c.place_id);
      if (best) {
        const second = await search(target.slug, { place_id: best.place_id });
        searchIds.push(second.search_metadata?.id ?? null);
        place = second.place_results;
        resolvedBy = `nearest candidate (${best.distance_m} m): ${best.title}`;
      } else {
        await write(join(RAW, "unresolved", `${target.slug}.json`), {
          slug: target.slug,
          query: target.query,
          fetched_at: new Date().toISOString(),
          search_ids: searchIds,
          reason: `no candidate within ${MATCH_RADIUS_M} m`,
          candidates,
        });
        console.log(`${target.slug}: unresolved (${candidates.length} candidates, none within ${MATCH_RADIUS_M} m)`);
        continue;
      }
    }

    if (!place) {
      await write(join(RAW, "unresolved", `${target.slug}.json`), {
        slug: target.slug,
        query: target.query,
        fetched_at: new Date().toISOString(),
        search_ids: searchIds,
        reason: first.error ?? "no place_results or local_results",
      });
      console.log(`${target.slug}: unresolved (${first.error ?? "no results"})`);
      continue;
    }

    const coords = place.gps_coordinates;
    const away = coords ? distance(target.lat, target.lng, coords.latitude, coords.longitude) : null;
    await write(join(RAW, "places", `${target.slug}.json`), {
      slug: target.slug,
      query: target.query,
      fetched_at: new Date().toISOString(),
      search_ids: searchIds,
      resolved_by: resolvedBy,
      distance_from_ours_m: away,
      place: scrub(place),
    });
    const days = Object.keys(place.popular_times?.graph_results ?? {}).length;
    console.log(
      `${target.slug}: ${place.title} (${away ?? "?"} m away), ${days ? `popular times for ${days} days` : "no popular times"}`,
    );
  }
} catch (error) {
  if (error.message !== "budget") throw error;
}

console.log(`Spent ${spent} searches this run, ${ledger.length} in total.`);
