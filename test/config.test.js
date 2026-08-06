import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLocalConfig, loadConfig, parseConfigRows, parseKeywordRows } from "../src/config.js";

test("parseConfigRows turns [key, value] rows into an object", () => {
  const rows = [
    ["testMode", "false"],
    ["ignoredEmptyKey", undefined],
    [],
  ];
  assert.deepEqual(parseConfigRows(rows), { testMode: "false" });
});

test("parseKeywordRows groups keywords by action and skips disabled rows", () => {
  const rows = [
    ["repost", "セール"],
    ["like", "猫", "true"],
    ["like", "犬", "false"],
    ["unknown", "無視される"],
  ];
  assert.deepEqual(parseKeywordRows(rows), { repost: ["セール"], like: ["猫"] });
});

test("loadLocalConfig reads and parses a JSON file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pxb-config-"));
  const configPath = path.join(dir, "config.json");
  await writeFile(configPath, JSON.stringify({ testMode: true, rules: {} }));

  try {
    const config = await loadLocalConfig(configPath);
    assert.equal(config.testMode, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig lets TEST_MODE env var override the file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pxb-config-"));
  const configPath = path.join(dir, "config.json");
  await writeFile(configPath, JSON.stringify({ testMode: false, rules: {} }));

  try {
    const config = await loadConfig({ configPath, env: { TEST_MODE: "true" } });
    assert.equal(config.testMode, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadConfig merges Google Sheets keywords when enabled", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pxb-config-"));
  const configPath = path.join(dir, "config.json");
  await writeFile(
    configPath,
    JSON.stringify({
      testMode: true,
      rules: { repost: { enabled: true, keywords: ["old"] } },
      googleSheets: { enabled: true, spreadsheetId: "sheet-id", configRange: "Config!A:B", keywordRange: "Keywords!A:C" },
    })
  );

  const fetchRows = async ({ spreadsheetId }) => {
    assert.equal(spreadsheetId, "sheet-id");
    return {
      configRows: [["someOtherSetting", "42"]],
      keywordRows: [["repost", "新キーワード"]],
    };
  };

  try {
    const config = await loadConfig({ configPath, env: {}, fetchRows });
    assert.deepEqual(config.rules.repost.keywords, ["新キーワード"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
