async function extractPostId(article) {
  const href = await article.locator('a[href*="/status/"]').first().getAttribute("href").catch(() => null);
  if (!href) return null;
  const match = href.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Scrolls the timeline collecting up to `limit` unique posts. Stops early
 * once a few scrolls in a row yield no new posts (end of feed / rate limit).
 */
export async function fetchTimeline(page, { homeUrl, limit = 20 } = {}) {
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  const posts = [];
  const seen = new Set();
  let stableRounds = 0;

  while (posts.length < limit && stableRounds < 3) {
    const articles = await page.locator('article[data-testid="tweet"]').all();

    for (const article of articles) {
      if (posts.length >= limit) break;
      const id = await extractPostId(article);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const text = await article.locator('[data-testid="tweetText"]').first().innerText().catch(() => "");
      posts.push({ id, text });
    }

    const before = posts.length;
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1000);
    stableRounds = posts.length === before ? stableRounds + 1 : 0;
  }

  return posts;
}
