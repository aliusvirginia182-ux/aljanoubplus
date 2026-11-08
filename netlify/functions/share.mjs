const SUPABASE_URL = "https://gvppxzokwqwjnkifrugm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OGG3jg1JT-IDIPgUxgFaJA_XMTWzADd";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const page = ({ origin, id, title, description, image, status = 200, cache }) => {
  const articleUrl = id ? `${origin}/n/${encodeURIComponent(id)}` : origin;
  const spaUrl = id ? `${origin}/#/n/${encodeURIComponent(id)}` : origin;
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | الجنوب+</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(articleUrl)}">
<meta property="og:site_name" content="الجنوب+">
<meta property="og:type" content="article">
<meta property="og:locale" content="ar_AR">
<meta property="og:url" content="${escapeHtml(articleUrl)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script>location.replace(${JSON.stringify(spaUrl).replace(/</g, "\\u003c")});</script>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(spaUrl)}">اقرأ الخبر على موقع الجنوب+</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cache || "public, max-age=0, s-maxage=300",
      "X-Content-Type-Options": "nosniff"
    }
  });
};

export default async (request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const logoImage = `${origin}/assets/jnplus-logo.png`;

  // The article id may arrive in the original path (/n/ID) or in the rewritten query (?id=ID).
  // Anything after the first valid id (for example "%203" from a bad copy) is ignored.
  const m = url.pathname.match(/^\/n\/([^/]+)/);
  let raw = (m && m[1]) || url.searchParams.get("id") || "";
  try { raw = decodeURIComponent(raw); } catch (e) {}
  const id = (raw.trim().match(/^[A-Za-z0-9_-]+/) || [""])[0];

  if (!id) return Response.redirect(origin, 302);

  const generic = (status, cache) =>
    page({ origin, id: "", title: "الجنوب+", description: "آخر أخبار الجنوب واليمن والعالم العربي والدولي", image: logoImage, status, cache: cache || "no-store" });

  const getArticle = async () => {
    const api = new URL(`${SUPABASE_URL}/rest/v1/news`);
    api.searchParams.set("select", "id,title,summary,image_url");
    api.searchParams.set("id", `eq.${id}`);
    api.searchParams.set("status", "eq.published");
    api.searchParams.set("limit", "1");
    const res = await fetch(api, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, Accept: "application/json" }
    });
    if (!res.ok) throw new Error("supabase " + res.status);
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : null;
  };

  try {
    const a = await getArticle();

    // ?img=1 -> the article's own cover as an image file (works for old base64 covers too)
    if (url.searchParams.get("img") === "1") {
      const src = (a && a.image_url) || "";
      const d = src.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/);
      if (d) return new Response(Buffer.from(d[2], "base64"), { status: 200, headers: { "Content-Type": d[1], "Cache-Control": "public, max-age=86400" } });
      if (/^https:\/\//i.test(src)) return Response.redirect(src, 302);
      return Response.redirect(logoImage, 302);
    }

    if (!a) return generic(404);

    const title = a.title || "الجنوب+";
    const description = String(a.summary || title).slice(0, 200);
    const src = a.image_url || "";
    const image = /^https:\/\//i.test(src) ? src : /^data:image\//i.test(src) ? `${origin}/n/${encodeURIComponent(id)}?img=1` : logoImage;

    return page({ origin, id, title, description, image });
  } catch (e) {
    return generic(200);
  }
};
