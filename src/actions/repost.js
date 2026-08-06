/**
 * Reposts the given post. In test mode (default) this is a dry run: no
 * click happens, only the decision is returned/logged, per the dev rule
 * "本番実行前に必ずテストモードで確認する".
 */
export async function repost(page, postId, { testMode = true } = {}) {
  if (testMode) {
    return { postId, action: "repost", dryRun: true };
  }

  const article = page.locator(`article[data-testid="tweet"]:has(a[href*="/status/${postId}"])`).first();
  await article.locator('[data-testid="retweet"]').click();
  await page.getByRole("menuitem", { name: /repost/i }).click();

  return { postId, action: "repost", dryRun: false };
}
