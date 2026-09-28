/**
 * The site's one Wix client: an anonymous visitor token, and the two reads built on it.
 *
 * **Why a visitor token and not a key.** `WIX_OAUTH_CLIENT_ID` is not itself a bearer
 * credential — it only proves a request is coming from this site's headless app, and it is
 * already scoped to one site because it was created inside that site's own Headless Settings,
 * which is why no site ID or client secret appears anywhere here. It is traded for a
 * short-lived token carrying exactly the identity an anonymous visitor on the Wix site would
 * have. So everything this module can read is already public, and the collections it reads
 * have to be set to `read: ANYONE` in the CMS or the query comes back empty rather than
 * failing — see FOUNDERS_COLLECTION.
 *
 * **Raw REST rather than `@wix/sdk`**, which is in `package.json` and unused. The site's one
 * other Wix call — `app/api/waitlist/route.ts` — is two `fetch`es against the same two
 * endpoints, and a second style for one POST would cost more in unfamiliarity than the SDK
 * saves; the token exchange below is the only thing it would have done for us. If the SDK is
 * ever adopted, it should take that route with it rather than sit beside it.
 *
 * Nothing here is a secret, so there is no `server-only` guard: a headless client ID is
 * designed to be used from browsers. What keeps this on the server is that `process.env`
 * reads it and only server components import it, which is also what lets the token cache
 * below be module scope rather than per visitor.
 */

const TOKEN_URL = "https://www.wixapis.com/oauth2/token";
const QUERY_URL = "https://www.wixapis.com/wix-data/v2/items/query";

/**
 * The collection behind the founders section. Created through the Data Collections API rather
 * than by hand so the schema is written down somewhere — `read: ANYONE`, everything else
 * `ADMIN`.
 */
export const FOUNDERS_COLLECTION = "Founders";

/**
 * The collection behind the approach section's three points. Same shape of thing as
 * FOUNDERS_COLLECTION and created the same way — `read: ANYONE`, everything else `ADMIN`.
 */
export const APPROACH_COLLECTION = "Approach";

/**
 * The collection behind the copy at the top of `/about` — the paragraphs that climb the screen
 * over the footage, and the footnote under their rule. Same permissions again, and **one row
 * with two fields** rather than a row per paragraph: `body` takes the prose with the blank-line
 * convention between paragraphs (`wixParagraphs`), `note` the footnote with one line per line
 * (`wixLines`).
 *
 * The one collection here whose section keeps its copy in the repo as well, and
 * `components/playground/content.ts` says why.
 */
export const ABOUT_INTRO_COLLECTION = "AboutIntro";

/**
 * The collection behind the home page's case-study cards. Same again — `read: ANYONE`,
 * everything else `ADMIN` — and the first one that feeds `app/page.tsx` rather than
 * `/about`, which is why that route now carries a `revalidate` of its own.
 *
 * Its rows are the cards' *content*; the row of cells, the pin and the traverse are all
 * derived from how many there are (see `components/cases/content.ts`).
 */
export const CASE_STUDIES_COLLECTION = "CaseStudies";

/**
 * The collection behind the case-study *pages* — one row per study, keyed by the slug its
 * route is served at (`cafe-technica`, `qcif`, `auto-maxx`). Same permissions as the rest.
 *
 * Deliberately **not** the same collection as `CASE_STUDIES_COLLECTION` above, which holds the
 * home page's cards. The two are the same subject and were nearly merged; they are separate
 * because the card is a picture and two lines and the page is forty fields, and putting them in
 * one row makes editing a card mean scrolling past a case study. The slug is the join: a card's
 * `link` is `/work/<this row's id>`.
 */
export const CASE_STUDY_PAGES_COLLECTION = "CaseStudyPages";

/**
 * The summary-of-deliverables table, as one row per *line* of it rather than one per study.
 *
 * It is a second collection and not a field because the table is two levels deep — terms, each
 * holding either a paragraph or a grid of cards — and nothing flat expresses that. A row is
 * `study` + `group` + an optional card `title` + `body`; rows sharing a `group` are one term,
 * and a group whose rows have titles renders as cards. See `components/study/cms.ts`.
 */
export const CASE_STUDY_DELIVERABLES_COLLECTION = "CaseStudyDeliverables";

/**
 * How long a page holds its copy of the CMS before asking again.
 *
 * **A minute, and the argument for it is that both alternatives were worse.** This started at
 * an hour, on the reasoning that a founders' section is not a feed — true about how often the
 * copy changes, and wrong about the only moment anyone looks at it, which is the client
 * reloading straight after an edit to check their own wording.
 *
 * The textbook answer to that is on-demand revalidation — tag the fetch, and have Wix call a
 * route handler that drops the tag. It was built and then removed, because driving it from Wix
 * costs **three automations per collection** (created, updated, deleted, each naming exactly one
 * collection): six to set up and keep in step today, three more for every collection added
 * later, and a shared secret to carry through every environment. That is a standing maintenance
 * cost, paid by whoever inherits this, to save fifty-nine seconds.
 *
 * So the poll is the update path and there is nothing to wire up. The cost is one Wix round trip
 * per minute **per page somebody actually asks for** — Next only refetches on a request that
 * finds the cache stale, so a quiet site makes none at all, and a busy one makes sixty an hour
 * against a rate limit measured in hundreds per minute. If this ever needs to be instant, the
 * shape of the answer is `next: { tags }` here plus a route handler calling `revalidateTag(tag,
 * { expire: 0 })` — the arithmetic above is what to re-check first, not the code.
 */
export const WIX_REVALIDATE_SECONDS = 60;

/**
 * The token is cached in module scope, not fetched per request, and the margin is what makes
 * that safe: a token handed out with one second left on it would be spent by the time the
 * query using it lands.
 *
 * This is deliberately not a `Promise` cache — two concurrent cold renders each doing a token
 * exchange is a wasted request, not a bug, and the alternative keeps a rejected promise alive
 * for every later caller.
 */
const EXPIRY_MARGIN_MS = 60_000;
let cached: { token: string; expiresAt: number } | null = null;

/**
 * How long Next's own data cache may hold the token *response*, which is a separate question
 * from the module cache above and is the one that decides whether a page using this can be
 * prerendered at all.
 *
 * It cannot be `cache: "no-store"`, which is the obvious thing to write for a credential and
 * is wrong here: a single uncached fetch opts the whole route segment out of static rendering,
 * and `/about` went dynamic for exactly this reason before this constant existed.
 *
 * **What this number does not bound is how old a served response can be, and assuming it did
 * was a real bug** — see `tokenExpiry` below.
 */
const TOKEN_CACHE_SECONDS = 1800;

/**
 * When the token itself says it expires, in ms, or `null` if it doesn't say.
 *
 * **Read this rather than `Date.now() + expires_in`, which is the same mistake this repo keeps
 * making in animation code: two clocks over one moment.** `expires_in` is a *duration* and only
 * becomes a deadline against the instant the token was minted — so using our own clock silently
 * assumes the response just arrived off the wire. It doesn't have to have: the fetch above is
 * cached by Next, and a cached entry past its revalidate window is served **as-is, at whatever
 * age it has**, while the refetch happens in the background. So after a quiet night a dev server
 * (or a low-traffic deployment) hands the first render of the day a body hours old, and the old
 * arithmetic stamped that dead token "good for another four hours".
 *
 * The symptom is not an auth error, which is what makes it hard to place: Wix answers a query
 * carrying an unresolvable visitor session with `400 WDE0117: MetaSite not found`, whose own
 * docs describe it as a system error to retry. Retrying does not help — the module cache hands
 * the same dead token back. Measured: a cached body 17.1h old against a token issued with
 * `expires_in: 14400` reproduced it exactly, on every collection in that render.
 *
 * The token is a Wix JWS — `OauthNG.JWS.<header>.<payload>.<signature>` — and its payload
 * carries `iat` and `exp` in seconds. This only *reads* those; nothing here verifies the
 * signature, and nothing needs to, because the token is not a credential we are trusting, it
 * is one we are about to spend. The worst a misread can do is send us to fetch another.
 */
function tokenExpiry(token: string): number | null {
  // `OauthNG` . `JWS` . header . payload . signature — so the claims are at index 3, and
  // anything shorter is a shape we don't know rather than a token to guess at.
  const parts = token.split(".");
  if (parts.length < 4) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(parts[3], "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * The token's own deadline, less the margin.
 *
 * Falls back to our clock only when the token doesn't carry one, which is the old behaviour and
 * is unsafe in exactly the way `tokenExpiry` describes — a stale body would again be stamped
 * good for four more hours, and nothing downstream could tell. That is what the dev warning is
 * for: this fallback is not a safety net, it is the bug held open, and the only thing that
 * should ever reach it is a token shape Wix has changed under us.
 */
function expiryOf(body: { access_token: string; expires_in?: number }): number {
  const own = tokenExpiry(body.access_token);

  if (process.env.NODE_ENV !== "production") {
    if (own === null) {
      console.error(
        "[wix] could not read `exp` out of the visitor token, so its expiry is being measured " +
        "from this clock instead — which is the assumption that shipped WDE0117 (see " +
        "tokenExpiry in lib/wix). The token's shape has probably changed.",
      );
    } else if (body.expires_in && body.expires_in < TOKEN_CACHE_SECONDS) {
      console.warn(
        `[wix] the visitor token now lives ${body.expires_in}s, which is shorter than the ` +
        `${TOKEN_CACHE_SECONDS}s its response is cached for — every cached serve past that ` +
        "window will now need the extra round trip. Lower TOKEN_CACHE_SECONDS.",
      );
    }
  }

  const base = own ?? Date.now() + (body.expires_in ?? 14400) * 1000;
  return base - EXPIRY_MARGIN_MS;
}

/**
 * A token exchange Next's data cache cannot answer from an old entry.
 *
 * `cache: "no-store"` is the obvious way to force that and is the one thing this module may not
 * do (see TOKEN_CACHE_SECONDS). A URL it has never seen has the same effect and stays a
 * *cacheable* fetch, so the route is still prerenderable — Wix ignores the extra parameter and
 * returns an ordinary four-hour token (verified against both forms of the URL).
 *
 * Only reached when a served token is already spent, i.e. once per quiet period, so the
 * cache-key churn is a handful of entries that expire on their own.
 */
const freshTokenUrl = () => `${TOKEN_URL}?fresh=${Date.now()}`;

async function exchange(clientId: string, url: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, grantType: "anonymous" }),
    next: { revalidate: TOKEN_CACHE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`[wix] token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

export async function wixVisitorToken(): Promise<string> {
  const clientId = process.env.WIX_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("[wix] WIX_OAUTH_CLIENT_ID is not set");

  if (cached && Date.now() < cached.expiresAt) return cached.token;

  let body = await exchange(clientId, TOKEN_URL);
  let expiresAt = expiryOf(body);

  // The token we were handed is already spent, so the response came out of the cache rather
  // than off the wire. Ask again at a URL the cache has no entry for.
  if (expiresAt <= Date.now()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[wix] the cached token exchange returned a token that expired " +
        `${Math.round((Date.now() - expiresAt) / 60_000)} minutes ago — Next served a stale ` +
        "response. Fetching a fresh one; see tokenExpiry in lib/wix.",
      );
    }
    body = await exchange(clientId, freshTokenUrl());
    expiresAt = expiryOf(body);
  }

  cached = { token: body.access_token, expiresAt };
  return cached.token;
}


export type WixDataItem = Record<string, unknown>;

/**
 * A CMS TEXT field as a trimmed string, or `""` for anything that is not one.
 *
 * Here rather than in a section's own content module because a CMS row is not typed and every
 * section reading one has the same problem: a field can be absent, `null`, or a number because
 * somebody typed a year into a text box. One coercion, used at every boundary.
 */
export const wixText = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * A CMS TEXT field split into paragraphs on blank lines, with single newlines inside a
 * paragraph treated as wrapping rather than as breaks.
 *
 * **Blank-line separation is this site's CMS authoring convention, not one section's**, which
 * is why it lives here and is named in the `displayName` of every field that uses it
 * ("Body (blank line between paragraphs)"). The alternative at the time was a rich-text field,
 * which arrives as Wix's own Ricos JSON and would need a renderer for markup none of these
 * sections use, or a repeater, which makes one block several rows to edit. A blank line is what
 * the person typing it will type anyway.
 */
export const wixParagraphs = (v: unknown) =>
  wixText(v)
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);

/**
 * A CMS TEXT field split on every newline — one line in the box is one entry out.
 *
 * The counterpart to `wixParagraphs`, and the difference is what a line break *means* in the
 * field. A run of prose wraps, so only a blank line can separate paragraphs; a list does not
 * wrap, so a single newline is the separator and a blank line is just spacing. Both conventions
 * are named in the `description` of every field that uses them, which is what the client reads
 * in the CMS.
 *
 * Used for the things on a case study that are genuinely lists: the three lines of the client
 * block, the hero headline's hand-set line breaks, the chart's bars and the credits' rows.
 */
export const wixLines = (v: unknown) =>
  wixText(v)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * One page of a collection, sorted. Returns the `data` objects rather than the envelope,
 * because nothing here wants the envelope.
 *
 * Callers get `null` on any failure rather than an exception, and that is the whole
 * availability story for this site: a section built on the CMS falls back to nothing on the
 * page instead of taking the route down with it (see `foundersFromWix`).
 */
export async function wixQuery(
  dataCollectionId: string,
  {
    sortField,
    filter,
    limit = 50,
  }: {
    sortField?: string;
    /**
     * A Wix Data filter, e.g. `{ study: "qcif" }`. Passed through as given — this module does
     * not build filters, it forwards one, and every caller so far wants a single equality.
     */
    filter?: Record<string, unknown>;
    limit?: number;
  } = {},
): Promise<WixDataItem[] | null> {
  try {
    const token = await wixVisitorToken();
    const res = await fetch(QUERY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({
        dataCollectionId,
        query: {
          ...(filter ? { filter } : {}),
          ...(sortField ? { sort: [{ fieldName: sortField, order: "ASC" }] } : {}),
          paging: { limit },
        },
      }),
      next: { revalidate: WIX_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`[wix] query ${dataCollectionId} failed`, res.status, await res.text());
      return null;
    }
    const body = (await res.json()) as { dataItems?: { data?: WixDataItem }[] };
    return (body.dataItems ?? []).map((i) => i.data ?? {});
  } catch (err) {
    console.error(`[wix] query ${dataCollectionId} threw`, err);
    return null;
  }
}

/**
 * A Media Manager image, as the CMS stores it and as the browser needs it.
 *
 * An IMAGE field comes back as a `wix:image://v1/<fileId>/<display name>#originWidth=…` URI,
 * which is a Wix-internal address and not something a browser can load. The file ID inside it
 * is the path segment on `static.wixstatic.com`, and the rest of the path is Wix's own image
 * service: `/v1/fill/w_…,h_…,al_c,q_…,enc_auto/<name>` returns that file resized and
 * re-encoded on their CDN.
 *
 * **Sizing happens there rather than through `next/image`**, and that is a choice worth
 * stating: the founders' photographs are 2MB PNGs a third of a screen wide, so they have to
 * be resized by *somebody*, and doing it at the CDN keeps the origin out of the path
 * entirely — no `remotePatterns`, no optimiser round trip on a cold cache, and a URL whose
 * dimensions are legible at the call site. The cost is that the `srcset` is hand-built rather
 * than generated, which is `wixSrcSet` below and is four lines.
 */
export type WixImage = { fileId: string; name: string; width: number; height: number };

export function parseWixImage(value: unknown): WixImage | null {
  if (typeof value !== "string" || !value.startsWith("wix:image://")) return null;
  // wix:image://v1/<fileId>/<name>#originWidth=<w>&originHeight=<h>
  const [path, hash = ""] = value.slice("wix:image://".length).split("#");
  const parts = path.split("/");
  if (parts.length < 3) return null;
  const params = new URLSearchParams(hash);
  return {
    fileId: parts[1],
    name: parts.slice(2).join("/"),
    width: Number(params.get("originWidth")) || 0,
    height: Number(params.get("originHeight")) || 0,
  };
}

/**
 * The file itself, unresized — the same URL the Media Manager returns for it.
 *
 * The counterpart to `wixImageUrl` below, and the choice between them is *who resizes*. The
 * founders' photographs are sized at the CDN, because the layout already knows the box it
 * draws them in and nothing there wants the optimiser in the path. The case-study cards are
 * the other case: they were `next/image` against files in `/public` before their content
 * moved to the CMS, their box is viewport-relative rather than fixed, and `next/image` is
 * what already picks a width out of `sizes` for them. So this hands it the original, exactly
 * as a file in `/public` did, and nothing about the delivered image changes.
 *
 * It also sidesteps the one way a CDN box can alter a picture: `fill` *crops* to the box it
 * is given, so any box whose ratio is not the file's own would quietly re-frame an image
 * that `object-position` is already framing in CSS.
 */
export const wixOriginalUrl = (img: WixImage) =>
  `https://static.wixstatic.com/media/${img.fileId}`;

/** One CDN URL, filled to a box. `fill` crops to the box rather than letterboxing it. */
export function wixImageUrl(img: WixImage, w: number, h: number, quality = 85) {
  const box = `w_${Math.round(w)},h_${Math.round(h)},al_c,q_${quality},enc_auto`;
  return `https://static.wixstatic.com/media/${img.fileId}/v1/fill/${box}/${encodeURIComponent(img.name)}`;
}

/**
 * 1× and 2× of the same box. Two entries and not a ladder because every place this is used
 * renders at a size the layout already knows — there is no `sizes` guesswork to cover, only
 * pixel density.
 */
export function wixSrcSet(img: WixImage, w: number, h: number) {
  return `${wixImageUrl(img, w, h)} 1x, ${wixImageUrl(img, w * 2, h * 2)} 2x`;
}

/**
 * A Media Manager video, as a CMS VIDEO field stores it.
 *
 * `wix:video://v1/<videoId>/<file name>#posterUri=<image id>&posterWidth=…&posterHeight=…` —
 * the same shape as the image URI above, with a poster frame in place of the origin size. The
 * poster is a frame *of the clip*, so its dimensions are the clip's, which is the only place a
 * video's aspect ratio is available to us without downloading it.
 *
 * **Everything after the video id is optional here, deliberately.** This URI is written by the
 * CMS's own media picker rather than by us, so the one part worth relying on is the id in the
 * path; a missing or renamed hash parameter costs a poster and a measured ratio, not the video.
 * A plain `https://video.wixstatic.com/video/<id>/…` URL is accepted too, because that is what
 * somebody pasting a link out of the Media Manager will produce.
 */
export type WixVideo = {
  videoId: string;
  name: string;
  /** The poster frame's own Media Manager id, or `null` when the URI doesn't carry one. */
  posterId: string | null;
  /** The clip's pixel size, read off the poster. `0` when the URI doesn't say. */
  width: number;
  height: number;
};

export function parseWixVideo(value: unknown): WixVideo | null {
  if (typeof value !== "string" || !value) return null;

  if (value.startsWith("wix:video://")) {
    const [path, hash = ""] = value.slice("wix:video://".length).split("#");
    const parts = path.split("/");
    // v1 / <videoId> / <name…> — anything without an id is not a video we can play.
    if (parts.length < 2 || !parts[1]) return null;
    const params = new URLSearchParams(hash);
    return {
      videoId: parts[1],
      name: parts.slice(2).join("/"),
      posterId: params.get("posterUri"),
      width: Number(params.get("posterWidth")) || 0,
      height: Number(params.get("posterHeight")) || 0,
    };
  }

  const direct = value.match(/^https:\/\/video\.wixstatic\.com\/video\/([^/?#]+)/);
  if (!direct) return null;
  return { videoId: direct[1], name: "", posterId: null, width: 0, height: 0 };
}

/**
 * The clip's playable URLs, best first — fed to a `<video>` as several `<source>`s.
 *
 * **A single hardcoded resolution is what this replaces, and it was a latent 403.** Wix
 * transcodes an upload only as far as its source resolution goes, so `720p` exists for some
 * clips and not others: measured on this site's own assets, the re-cropped hero clips (922×582
 * and 904×548) serve `480p` and the original, and answer `720p` with a flat `403`. The old code
 * asked for `720p` by name because the clips it was written against happened to have one.
 *
 * `480p` is Wix's baseline transcode and is what every clip has; `/file` is the upload itself
 * and therefore cannot be missing. A browser walking a `<source>` list moves to the next entry
 * when one fails to load, so the pair is "the small one if it exists, the original if not" with
 * no knowledge of the asset needed — which is the point, since the asset is now the client's to
 * change. The original is two to three times the size, so it is the fallback and not the lead.
 */
export const wixVideoSources = (video: WixVideo) => [
  `https://video.wixstatic.com/video/${video.videoId}/480p/mp4/file.mp4`,
  `https://video.wixstatic.com/video/${video.videoId}/file`,
];

/** The clip's poster frame, for the `poster` attribute. `undefined` when the URI has none. */
export const wixPosterUrl = (video: WixVideo) =>
  video.posterId
    ? `https://static.wixstatic.com/media/${video.posterId}`
    : undefined;
