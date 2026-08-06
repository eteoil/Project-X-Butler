/**
 * Project X Butler - メイン処理
 *
 * 1日1回、対象アカウントのその日の投稿を読み、キーワードに一致した投稿を
 * 公式 X API でリポストする。
 */

var TRIGGER_FUNCTION = 'dailyRun';

/** スプレッドシートを開いたときに専用メニューを出す */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌹 X Butler')
    .addItem('初期セットアップ（シート作成）', 'setupSheets')
    .addSeparator()
    .addItem('今すぐ実行（テストモード）', 'runNowInTestMode')
    .addItem('今すぐ実行（本番）', 'runNowForReal')
    .addSeparator()
    .addItem('毎日23:59の自動実行を設定', 'installDailyTrigger')
    .addItem('自動実行を解除', 'removeDailyTrigger')
    .addItem('自動実行の状態を確認', 'showTriggerStatus')
    .addSeparator()
    .addItem('接続テスト', 'testConnection')
    .addItem('認証診断（401が出るとき）', 'diagnoseAuth')
    .addToUi();
}

/**
 * 毎日のトリガーから呼ばれる入口。
 * 実行するかどうか（テストモードか本番か）は「設定」シートの内容に従う。
 */
function dailyRun() {
  runButler_({});
}

/** メニュー用：設定に関わらずテストモードで実行する */
function runNowInTestMode() {
  var summary = runButler_({ testMode: true });
  showSummary_('テスト実行が完了しました', summary);
}

/** メニュー用：確認のうえ、実際にリポストする */
function runNowForReal() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    '本番実行',
    '実際にリポストします。よろしいですか？\n（先にテストモードでログを確認することをおすすめします）',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  var summary = runButler_({ testMode: false });
  showSummary_('本番実行が完了しました', summary);
}

/**
 * 本体の処理。
 *
 * @param {Object} overrides 設定を上書きしたい項目（testMode など）
 * @return {Object} 実行結果のサマリー
 */
function runButler_(overrides) {
  overrides = overrides || {};

  var now = new Date();
  var config = loadConfig();
  if (overrides.testMode !== undefined) {
    config.testMode = overrides.testMode;
  }

  var targetDate = resolveTargetDate(now);
  var targetDateLabel = formatDateLabel(targetDate);
  var dayWindow = buildDayWindow(targetDate, now);

  appendLog({
    targetDate: targetDateLabel,
    action: ACTION_INFO,
    result: '実行開始（対象: @' + config.targetAccount + ' / ' +
            (config.testMode ? 'テストモード' : '本番') + '）',
  });

  var summary = {
    targetDate: targetDateLabel,
    targetAccount: config.targetAccount,
    testMode: config.testMode,
    scanned: 0,
    matched: 0,
    reposted: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    var targetUserId = getUserIdByUsername(config.targetAccount);
    var tweets = fetchTweetsInWindow(targetUserId, dayWindow, { includeReplies: config.includeReplies });
    summary.scanned = tweets.length;

    var matches = judgeTweets(tweets, config.keywords);
    summary.matched = matches.length;

    var alreadyReposted = loadRepostedIds();
    var myUserId = config.testMode ? null : getMyUserId();

    for (var i = 0; i < matches.length; i++) {
      var tweet = matches[i].tweet;
      var matched = matches[i].matched;
      var url = buildTweetUrl(config.targetAccount, tweet.id);

      if (alreadyReposted[tweet.id]) {
        summary.skipped++;
        appendLog({
          targetDate: targetDateLabel, tweetId: tweet.id, url: url, matched: matched,
          action: ACTION_SKIP, result: 'リポスト済みのためスキップ',
        });
        continue;
      }

      if (summary.reposted >= config.maxRepostsPerRun) {
        summary.skipped++;
        appendLog({
          targetDate: targetDateLabel, tweetId: tweet.id, url: url, matched: matched,
          action: ACTION_SKIP, result: '1回あたりの上限（' + config.maxRepostsPerRun + '件）に達したためスキップ',
        });
        continue;
      }

      if (config.testMode) {
        summary.reposted++;
        appendLog({
          targetDate: targetDateLabel, tweetId: tweet.id, url: url, matched: matched,
          action: ACTION_REPOST, result: RESULT_DRY_RUN,
        });
        continue;
      }

      try {
        repostTweet(myUserId, tweet.id);
        summary.reposted++;
        alreadyReposted[tweet.id] = true;
        appendLog({
          targetDate: targetDateLabel, tweetId: tweet.id, url: url, matched: matched,
          action: ACTION_REPOST, result: RESULT_DONE,
        });
      } catch (err) {
        summary.failed++;
        appendLog({
          targetDate: targetDateLabel, tweetId: tweet.id, url: url, matched: matched,
          action: ACTION_ERROR, result: String(err.message || err),
        });
      }
    }

    appendLog({
      targetDate: targetDateLabel,
      action: ACTION_INFO,
      result: '実行完了（取得 ' + summary.scanned + '件 / 一致 ' + summary.matched +
              '件 / リポスト ' + summary.reposted + '件 / スキップ ' + summary.skipped +
              '件 / 失敗 ' + summary.failed + '件）',
    });

  } catch (err) {
    appendLog({
      targetDate: targetDateLabel,
      action: ACTION_ERROR,
      result: String(err.message || err),
    });
    throw err;
  }

  return summary;
}

// ---- トリガー管理 ----

/** 毎日 23:59 ごろに dailyRun を動かすトリガーを作る */
function installDailyTrigger() {
  removeDailyTrigger_();

  ScriptApp.newTrigger(TRIGGER_FUNCTION)
    .timeBased()
    .atHour(23)
    .nearMinute(59)
    .everyDays(1)
    .create();

  SpreadsheetApp.getUi().alert(
    '自動実行を設定しました',
    '毎日 23:59 ごろに実行します。\n\n' +
    'GAS のタイマーには±15分ほどのゆれがあるため、実際の実行は 23:45〜0:15 の間になります。' +
    '日付をまたいで実行された場合も、前日分を対象として処理します。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** メニュー用：自動実行を解除する */
function removeDailyTrigger() {
  var removed = removeDailyTrigger_();
  SpreadsheetApp.getUi().alert(
    removed > 0 ? '自動実行を解除しました。' : '設定されている自動実行はありませんでした。'
  );
}

function removeDailyTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  return removed;
}

/** メニュー用：トリガーが設定されているか確認する */
function showTriggerStatus() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;

  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === TRIGGER_FUNCTION) count++;
  }

  SpreadsheetApp.getUi().alert(
    count > 0
      ? '自動実行は有効です（' + count + '件）。毎日 23:59 ごろに実行されます。'
      : '自動実行は設定されていません。'
  );
}

// ---- 動作確認 ----

/**
 * 認証情報と設定が正しいかを、リポストせずに確認する。
 */
function testConnection() {
  var ui = SpreadsheetApp.getUi();
  var lines = [];

  try {
    var config = loadConfig();
    lines.push('✅ 設定シート: 読み込み成功');
    lines.push('　　対象アカウント: @' + config.targetAccount);
    lines.push('　　キーワード: ' + config.keywords.join('、'));
    lines.push('　　テストモード: ' + (config.testMode ? 'ON' : 'OFF'));

    var myUserId = getMyUserId();
    var myUsername = PropertiesService.getScriptProperties().getProperty('X_MY_USERNAME');
    lines.push('✅ X API 認証: 成功（@' + myUsername + ' として接続）');

    var targetUserId = getUserIdByUsername(config.targetAccount);
    lines.push('✅ 対象アカウント: 見つかりました（ID: ' + targetUserId + '）');

    var now = new Date();
    var targetDate = resolveTargetDate(now);
    var dayWindow = buildDayWindow(targetDate, now);
    var tweets = fetchTweetsInWindow(targetUserId, dayWindow, { includeReplies: config.includeReplies });
    lines.push('✅ 投稿の取得: ' + formatDateLabel(targetDate) + ' の投稿を ' + tweets.length + '件 取得');

    var matches = judgeTweets(tweets, config.keywords);
    lines.push('✅ キーワード判定: ' + matches.length + '件が一致');

  } catch (err) {
    lines.push('❌ エラー: ' + String(err.message || err));
  }

  ui.alert('接続テスト', lines.join('\n'), ui.ButtonSet.OK);
}

function showSummary_(title, summary) {
  SpreadsheetApp.getUi().alert(
    title,
    '対象日: ' + summary.targetDate + '\n' +
    '対象アカウント: @' + summary.targetAccount + '\n' +
    'モード: ' + (summary.testMode ? 'テストモード（実際にはリポストしていません）' : '本番') + '\n\n' +
    '取得した投稿: ' + summary.scanned + '件\n' +
    'キーワード一致: ' + summary.matched + '件\n' +
    'リポスト: ' + summary.reposted + '件\n' +
    'スキップ: ' + summary.skipped + '件\n' +
    '失敗: ' + summary.failed + '件\n\n' +
    '詳細は「' + SHEET_LOG + '」シートを確認してください。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
