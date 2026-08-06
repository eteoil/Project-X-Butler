import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

export async function launchBrowser({ headless = true } = {}) {
  return chromium.launch({ headless });
}

/**
 * Opens a context reusing a saved login session (storageStatePath) when one
 * exists, so the bot doesn't have to log in on every run.
 */
export async function newContext(browser, { storageStatePath } = {}) {
  let storageState;
  if (storageStatePath) {
    try {
      storageState = JSON.parse(await readFile(storageStatePath, "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  return browser.newContext(storageState ? { storageState } : {});
}
