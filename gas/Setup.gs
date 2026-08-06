/**
 * 初期セットアップ
 *
 * 「設定」「キーワード」「ログ」の3シートを、見出しと初期値つきで作る。
 * すでにあるシートは中身を消さずにそのまま残す。
 */

function setupSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];

  if (!spreadsheet.getSheetByName(SHEET_SETTINGS)) {
    createSettingsSheet_(spreadsheet);
    created.push(SHEET_SETTINGS);
  }
  if (!spreadsheet.getSheetByName(SHEET_KEYWORDS)) {
    createKeywordSheet_(spreadsheet);
    created.push(SHEET_KEYWORDS);
  }
  if (!spreadsheet.getSheetByName(SHEET_LOG)) {
    createLogSheet_(spreadsheet);
    created.push(SHEET_LOG);
  }

  SpreadsheetApp.getUi().alert(
    'セットアップ',
    created.length > 0
      ? '次のシートを作成しました: ' + created.join('、') + '\n\n' +
        '「' + SHEET_SETTINGS + '」シートに対象アカウントを、' +
        '「' + SHEET_KEYWORDS + '」シートにキーワードを入力してください。'
      : '必要なシートはすべて揃っています。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function createSettingsSheet_(spreadsheet) {
  var sheet = spreadsheet.insertSheet(SHEET_SETTINGS);

  var rows = [
    ['項目', '値', '説明'],
    ['対象アカウント', '', '監視したいアカウント名（@は不要）'],
    ['テストモード', true, 'TRUE の間は実際にリポストせず、ログに記録するだけ'],
    ['1回あたり最大リポスト数', 10, '1回の実行でリポストする上限件数'],
    ['リプライも対象にする', false, 'TRUE にすると対象アカウントのリプライも判定対象にする'],
  ];

  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('B3').insertCheckboxes();
  sheet.getRange('B5').insertCheckboxes();
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 380);
}

function createKeywordSheet_(spreadsheet) {
  var sheet = spreadsheet.insertSheet(SHEET_KEYWORDS);

  var rows = [
    ['キーワード', '有効', '説明'],
    ['', true, 'この語を含む投稿をリポストする（大文字・小文字は区別しない）'],
  ];

  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('B2:B100').insertCheckboxes();
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(3, 420);
}

function createLogSheet_(spreadsheet) {
  var sheet = spreadsheet.insertSheet(SHEET_LOG);

  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(7, 320);
}
