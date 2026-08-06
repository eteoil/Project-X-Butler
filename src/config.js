import { readFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "config", "config.json");
const EXAMPLE_CONFIG_PATH = path.join(process.cwd(), "config", "config.example.json");

/**
 * Loads config/config.json, falling back to config/config.example.json
 * (the checked-in template) when no local override exists yet.
 */
export async function loadLocalConfig(configPath = DEFAULT_CONFIG_PATH) {
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT" && configPath === DEFAULT_CONFIG_PATH) {
      const raw = await readFile(EXAMPLE_CONFIG_PATH, "utf8");
      return JSON.parse(raw);
    }
    throw err;
  }
}

/**
 * Parses the two-column "Config" sheet (key, value) into a plain object.
 * Pure function so it can be unit tested without a live Sheets API call.
 */
export function parseConfigRows(rows = []) {
  const overrides = {};
  for (const row of rows) {
    const [key, value] = row;
    if (!key || value === undefined) continue;
    overrides[key] = value;
  }
  return overrides;
}

/**
 * Parses the three-column "Keywords" sheet (action, keyword, enabled) into
 * { repost: string[], like: string[] }. Rows whose `enabled` column is the
 * literal string "false" (case-insensitive) are skipped. Pure function so
 * it can be unit tested without a live Sheets API call.
 */
export function parseKeywordRows(rows = []) {
  const rules = { repost: [], like: [] };
  for (const row of rows) {
    const [action, keyword, enabled] = row;
    if (!action || !keyword) continue;
    const key = String(action).toLowerCase();
    if (key !== "repost" && key !== "like") continue;
    if (enabled !== undefined && String(enabled).toLowerCase() === "false") continue;
    rules[key].push(keyword);
  }
  return rules;
}

/**
 * Reads the Config and Keywords ranges from a Google Sheet using a service
 * account. Requires real Google Cloud credentials, so this is not covered
 * by unit tests -- parseConfigRows/parseKeywordRows carry the test coverage
 * for the parsing logic instead.
 */
export async function fetchSheetsRows({ spreadsheetId, configRange, keywordRange, serviceAccountFile }) {
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const [configRes, keywordRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: configRange }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: keywordRange }),
  ]);

  return {
    configRows: configRes.data.values ?? [],
    keywordRows: keywordRes.data.values ?? [],
  };
}

/**
 * Loads the effective config for a run: local config/config.json as the
 * base, optionally layered with live Google Sheets values so non-engineers
 * can change keywords/settings without touching code, then TEST_MODE from
 * the environment always has the final say (safety net for "本番実行前に
 * 必ずテストモードで確認する").
 */
export async function loadConfig({ env = process.env, configPath, fetchRows = fetchSheetsRows } = {}) {
  const config = await loadLocalConfig(configPath);

  if (config.googleSheets?.enabled) {
    const spreadsheetId = env.GOOGLE_SPREADSHEET_ID || config.googleSheets.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error(
        "googleSheets.enabled is true but no spreadsheet ID was provided (config.googleSheets.spreadsheetId or GOOGLE_SPREADSHEET_ID)"
      );
    }

    const { configRows, keywordRows } = await fetchRows({
      spreadsheetId,
      configRange: config.googleSheets.configRange,
      keywordRange: config.googleSheets.keywordRange,
      serviceAccountFile: env.GOOGLE_SERVICE_ACCOUNT_FILE,
    });

    const overrides = parseConfigRows(configRows);
    const rules = parseKeywordRows(keywordRows);

    if (rules.repost.length) {
      config.rules = config.rules ?? {};
      config.rules.repost = { ...config.rules.repost, keywords: rules.repost };
    }
    if (rules.like.length) {
      config.rules = config.rules ?? {};
      config.rules.like = { ...config.rules.like, keywords: rules.like };
    }
    if (overrides.testMode !== undefined && env.TEST_MODE === undefined) {
      config.testMode = String(overrides.testMode).toLowerCase() !== "false";
    }
  }

  if (env.TEST_MODE !== undefined) {
    config.testMode = env.TEST_MODE.toLowerCase() !== "false";
  }

  return config;
}
