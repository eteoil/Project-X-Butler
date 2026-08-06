/**
 * 設定の読み込み
 *
 * 運用ルール（対象アカウント・キーワードなど）はすべてスプレッドシート側に置き、
 * このファイルはそれを読み取るだけにしている。
 * 認証情報だけはスプレッドシートに書くと共有時に漏れるため、
 * スクリプトプロパティ（プロジェクトの設定 > スクリプト プロパティ）に保存する。
 */

var SHEET_SETTINGS = '設定';
var SHEET_KEYWORDS = 'キーワード';
var SHEET_LOG = 'ログ';

// 「設定」シートの項目名 → 内部で使うキー
var SETTING_KEYS = {
  '対象アカウント': 'targetAccount',
  'テストモード': 'testMode',
  '1回あたり最大リポスト数': 'maxRepostsPerRun',
  'リプライも対象にする': 'includeReplies',
};

/**
 * 「設定」シートと「キーワード」シートから、実行に必要な設定をまとめて読み込む。
 * @return {Object} 設定オブジェクト
 */
function loadConfig() {
  var settings = readSettingsSheet_();

  var config = {
    targetAccount: normalizeUsername_(settings.targetAccount),
    testMode: toBoolean_(settings.testMode, true), // 未設定なら安全側（テストモード）に倒す
    maxRepostsPerRun: toPositiveInt_(settings.maxRepostsPerRun, 10),
    includeReplies: toBoolean_(settings.includeReplies, false),
    keywords: readKeywordSheet_(),
  };

  if (!config.targetAccount) {
    throw new Error('「' + SHEET_SETTINGS + '」シートの「対象アカウント」が空です。監視したいアカウント名（@なし）を入力してください。');
  }
  if (config.keywords.length === 0) {
    throw new Error('「' + SHEET_KEYWORDS + '」シートに有効なキーワードが1つもありません。');
  }

  return config;
}

/**
 * 「設定」シート（A列=項目名, B列=値）を読み取る。
 * @return {Object} 内部キー → 値
 */
function readSettingsSheet_() {
  var sheet = getSheetOrThrow_(SHEET_SETTINGS);
  var values = sheet.getDataRange().getValues();
  var settings = {};

  for (var i = 0; i < values.length; i++) {
    var label = String(values[i][0]).trim();
    var key = SETTING_KEYS[label];
    if (key) {
      settings[key] = values[i][1];
    }
  }
  return settings;
}

/**
 * 「キーワード」シート（A列=キーワード, B列=有効）から、有効なキーワードだけを配列で返す。
 * @return {Array<string>}
 */
function readKeywordSheet_() {
  var sheet = getSheetOrThrow_(SHEET_KEYWORDS);
  var values = sheet.getDataRange().getValues();
  var keywords = [];

  for (var i = 0; i < values.length; i++) {
    var keyword = String(values[i][0]).trim();
    var enabled = values[i][1];

    // 1行目の見出し行と空行は読み飛ばす
    if (!keyword || keyword === 'キーワード') continue;
    // 「有効」列が空欄なら有効扱い。FALSE と書かれている行だけ無視する。
    if (enabled !== '' && enabled !== undefined && !toBoolean_(enabled, true)) continue;

    keywords.push(keyword);
  }
  return keywords;
}

/**
 * X API の認証情報をスクリプトプロパティから取得する。
 * @return {Object} 4つのキーを持つ認証情報
 */
function getCredentials_() {
  var props = PropertiesService.getScriptProperties();
  var creds = {
    apiKey: props.getProperty('X_API_KEY'),
    apiSecret: props.getProperty('X_API_SECRET'),
    accessToken: props.getProperty('X_ACCESS_TOKEN'),
    accessSecret: props.getProperty('X_ACCESS_TOKEN_SECRET'),
  };

  var missing = [];
  for (var key in creds) {
    if (!creds[key]) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      'X API の認証情報が未設定です（不足: ' + missing.join(', ') + '）。' +
      'スクリプトエディタの「プロジェクトの設定 > スクリプト プロパティ」に ' +
      'X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET を登録してください。'
    );
  }
  return creds;
}

// ---- 小さなユーティリティ ----

function getSheetOrThrow_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('「' + name + '」シートが見つかりません。メニューの「初期セットアップ」を実行してください。');
  }
  return sheet;
}

/** チェックボックス・TRUE/FALSE・「はい」などをまとめて真偽値にする */
function toBoolean_(value, defaultValue) {
  if (value === true || value === false) return value;
  if (value === '' || value === null || value === undefined) return defaultValue;

  var text = String(value).trim().toLowerCase();
  if (text === 'true' || text === 'はい' || text === 'on' || text === '1') return true;
  if (text === 'false' || text === 'いいえ' || text === 'off' || text === '0') return false;
  return defaultValue;
}

function toPositiveInt_(value, defaultValue) {
  var num = parseInt(value, 10);
  return (isNaN(num) || num < 1) ? defaultValue : num;
}

/** 「@example」「https://x.com/example」などを「example」に正規化する */
function normalizeUsername_(value) {
  if (!value) return '';
  var text = String(value).trim();
  text = text.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '');
  text = text.replace(/^@/, '');
  text = text.split(/[/?]/)[0];
  return text.trim();
}
