/**
 * 実行ログ
 *
 * 「ログ」シートに1行ずつ追記する。二重リポストの判定にもこのシートを使うので、
 * 行を手で消すと同じ投稿をもう一度リポストする可能性がある点に注意。
 */

var LOG_HEADERS = ['実行日時', '対象日', '投稿ID', 'URL', '一致キーワード', '動作', '結果'];

// 「動作」列に入る値
var ACTION_REPOST = 'リポスト';
var ACTION_SKIP = 'スキップ';
var ACTION_INFO = '情報';
var ACTION_ERROR = 'エラー';

// 「結果」列に入る値のうち、リポスト済み判定に使うもの
var RESULT_DONE = '成功';
var RESULT_DRY_RUN = 'テストモード（実行なし）';

/**
 * ログを1行追記する。
 *
 * @param {Object} entry {targetDate, tweetId, url, matched, action, result}
 */
function appendLog(entry) {
  var sheet = getLogSheet_();
  sheet.appendRow([
    new Date(),
    entry.targetDate || '',
    entry.tweetId ? "'" + entry.tweetId : '', // 18桁のIDが数値に丸められないよう文字列で入れる
    entry.url || '',
    entry.matched || '',
    entry.action || '',
    entry.result || '',
  ]);
}

/**
 * すでにリポスト済みの投稿IDを集める。
 * テストモードでの記録は「実際にはリポストしていない」ので対象外。
 *
 * @return {Object} 投稿IDをキーに持つオブジェクト（存在判定用）
 */
function loadRepostedIds() {
  var sheet = getLogSheet_();
  var lastRow = sheet.getLastRow();
  var reposted = {};

  if (lastRow < 2) return reposted;

  var values = sheet.getRange(2, 1, lastRow - 1, LOG_HEADERS.length).getValues();
  var idIndex = LOG_HEADERS.indexOf('投稿ID');
  var actionIndex = LOG_HEADERS.indexOf('動作');
  var resultIndex = LOG_HEADERS.indexOf('結果');

  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][idIndex]).replace(/^'/, '').trim();
    if (!id) continue;
    if (values[i][actionIndex] === ACTION_REPOST && values[i][resultIndex] === RESULT_DONE) {
      reposted[id] = true;
    }
  }
  return reposted;
}

function getLogSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_LOG);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_LOG);
    sheet.appendRow(LOG_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 投稿IDから X の投稿URLを組み立てる */
function buildTweetUrl(username, tweetId) {
  return 'https://x.com/' + username + '/status/' + tweetId;
}
