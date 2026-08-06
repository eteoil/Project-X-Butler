import { logger as defaultLogger } from "../logger.js";

// X's login flow renders the same generic <input> for both steps; selectors
// are best-effort and may need updating if X changes its login markup.
const USERNAME_SELECTOR = 'input[name="text"]';
const PASSWORD_SELECTOR = 'input[name="password"]';

export async function login(
  page,
  { username, password, loginUrl, storageStatePath },
  { logger = defaultLogger } = {}
) {
  if (!username || !password) {
    throw new Error("X_USERNAME and X_PASSWORD must be set to log in");
  }

  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  await page.locator(USERNAME_SELECTOR).first().fill(username);
  await page.getByRole("button", { name: /^次へ$|^Next$/ }).click();

  await page.locator(PASSWORD_SELECTOR).first().fill(password);
  await page.getByRole("button", { name: /^ログイン$|^Log in$/ }).click();

  await page.waitForURL("**/home", { timeout: 30000 });

  if (storageStatePath) {
    await page.context().storageState({ path: storageStatePath });
  }

  await logger.info("Logged in to X", { username });
}

export async function isLoggedIn(page, homeUrl) {
  try {
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    return page.url().includes("/home");
  } catch {
    return false;
  }
}
