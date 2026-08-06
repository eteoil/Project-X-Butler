export async function fetchProfile(page, { profileUrl }) {
  await page.goto(profileUrl, { waitUntil: "domcontentloaded" });

  const name = await page.locator('[data-testid="UserName"]').first().innerText().catch(() => null);
  const handle = await page.locator('[data-testid="UserScreenName"]').first().innerText().catch(() => null);

  return { name, handle, url: profileUrl };
}
