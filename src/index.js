import "dotenv/config";
import { launchBrowser, newContext } from "./browser.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { login } from "./x/login.js";
import { fetchTimeline } from "./x/timeline.js";
import { judgePosts } from "./keyword.js";
import { repost } from "./actions/repost.js";
import { like } from "./actions/like.js";

export async function run({ env = process.env } = {}) {
  const config = await loadConfig({ env });
  await logger.info("Starting run", { testMode: config.testMode });

  const browser = await launchBrowser({ headless: true });
  const context = await newContext(browser, { storageStatePath: config.x.storageStatePath });
  const page = await context.newPage();

  try {
    await login(page, {
      username: env.X_USERNAME,
      password: env.X_PASSWORD,
      loginUrl: config.x.loginUrl,
      storageStatePath: config.x.storageStatePath,
    });

    const posts = await fetchTimeline(page, {
      homeUrl: config.x.homeUrl,
      limit: config.limits?.timelinePostsToScan ?? 20,
    });
    await logger.info("Fetched timeline", { count: posts.length });

    const judged = judgePosts(posts, config.rules);
    const maxReposts = config.limits?.maxRepostsPerRun ?? Infinity;
    const maxLikes = config.limits?.maxLikesPerRun ?? Infinity;
    const results = [];
    let repostCount = 0;
    let likeCount = 0;

    for (const { post, decisions } of judged) {
      if (decisions.repost && repostCount < maxReposts) {
        const result = await repost(page, post.id, { testMode: config.testMode });
        await logger.info("Repost decision", { postId: post.id, matched: decisions.repost.matched, ...result });
        results.push(result);
        repostCount++;
      }
      if (decisions.like && likeCount < maxLikes) {
        const result = await like(page, post.id, { testMode: config.testMode });
        await logger.info("Like decision", { postId: post.id, matched: decisions.like.matched, ...result });
        results.push(result);
        likeCount++;
      }
    }

    await logger.info("Run complete", { scanned: posts.length, actions: results.length, testMode: config.testMode });
    return results;
  } finally {
    await context.close();
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(async (err) => {
    await logger.error("Run failed", { error: err.message });
    process.exitCode = 1;
  });
}
