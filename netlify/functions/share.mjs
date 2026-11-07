const SUPABASE_URL = "https://gvppxzokwqwjnkifrugm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OGG3jg1JT-IDIPgUxgFaJA_XMTWzADd";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

const isSocialCrawler = (ua = "") =>
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|TelegramBot|Discordbot|Slackbot|Pinterest|Google-InspectionTool|Googlebot|bingbot/i.test(ua);

export default async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response("Invalid article ID", { status: 400 });
  }

  const articleUrl = `${url.origin}/n/${encodeURIComponent(id)}`;
  const userAgent = request.headers.get("user-agent") || "";

  // Real visitors are sent to the existing single-page application.
  if (!isSocialCrawler(userAgent)) {
    return Response.redirect(`${url.origin}/#/n/${encodeURIComponent(id)}`, 302);
  }

  try {
    const apiUrl = new URL(`${SUPABASE_URL}/rest/v1/news`);
    apiUrl.searchParams.set("select", "id,title,summary,category,image_url,status");
    apiUrl.searchParams.set("id", `eq.${id}`);
    apiUrl.searchParams.set("status", "eq.published");
    apiUrl.searchParams.set("limit", "1");

    const result = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: "application/json"
      }
    });

    if (!result.ok) {
      return new Response("Could not load article metadata", { status: 502 });
    }

    const rows = await result.json();
    const article = rows?.[0];
    if (!article) return new Response("Article not found", { status: 404 });

    const title = article.title || "الجنوب+";
    const description = article.summary || title;
    const image = article.image_url || `${url.origin}/assets/social-reference.png`;

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
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
<p><a href="${escapeHtml(url.origin + "/#/n/" + encodeURIComponent(id))}">اقرأ الخبر على موقع الجنوب+</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return new Response("Share preview temporarily unavailable", { status: 500 });
  }
};
