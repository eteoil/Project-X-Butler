/**
 * Likes the given post. In test mode (default) this is a dry run: no click
 * happens, only the decision is returned/logged, per the dev rule
 * "本番実行前に必ずテストモードで確認する".
 */
export async function like(page, postId, { testMode = true } = {}) {
  if (testMode) {
    return { postId, action: "like", dryRun: true };
  }

  const article = page.locator(`article[data-testid="tweet"]:has(a[href*="/status/${postId}"])`).first();
  await article.locator('[data-testid="like"]').click();

  return { postId, action: "like", dryRun: false };
}
