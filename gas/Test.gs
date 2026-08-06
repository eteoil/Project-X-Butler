/**
 * テスト
 *
 * X API にもスプレッドシートの内容にも依存しない部分（キーワード判定・
 * 日付計算・OAuth署名の下ごしらえ）を検証する。
 *
 * 使い方: スクリプトエディタで実行する関数に runAllTests を選び、実行する。
 * 結果は「実行ログ」（Ctrl+Enter / 表示 > ログ）に出る。
 */

function runAllTests() {
  var results = [];

  results = results.concat(testMatchKeyword_());
  results = results.concat(testJudgeTweets_());
  results = results.concat(testResolveTargetDate_());
  results = results.concat(testBuildDayWindow_());
  results = results.concat(testPercentEncode_());
  results = results.concat(testOAuthSignature_());
  results = results.concat(testNormalizeUsername_());
  results = results.concat(testToBoolean_());

  var failed = results.filter(function (r) { return !r.ok; });

  Logger.log('---- テスト結果 ----');
  for (var i = 0; i < results.length; i++) {
    Logger.log((results[i].ok ? '✅' : '❌') + ' ' + results[i].name +
               (results[i].ok ? '' : ' … ' + results[i].detail));
  }
  Logger.log('---- ' + (results.length - failed.length) + ' / ' + results.length + ' 件が成功 ----');

  if (failed.length > 0) {
    throw new Error(failed.length + '件のテストが失敗しました。詳細はログを確認してください。');
  }
  return results.length + '件すべて成功';
}

// ---- キーワード判定 ----

function testMatchKeyword_() {
  return [
    assertEquals_('一致したキーワードを返す',
      matchKeyword('本日セール開催中', ['セール']), 'セール'),

    assertEquals_('一致しなければ null',
      matchKeyword('今日は晴れ', ['セール', '新商品']), null),

    assertEquals_('英字は大文字小文字を区別しない',
      matchKeyword('Big SALE today', ['sale']), 'sale'),

    assertEquals_('本文が空なら null',
      matchKeyword('', ['セール']), null),

    assertEquals_('キーワードが空配列なら null',
      matchKeyword('本日セール開催中', []), null),

    assertEquals_('前後の空白は無視して判定する',
      matchKeyword('本日セール開催中', ['  セール  ']), '  セール  '),
  ];
}

function testJudgeTweets_() {
  var tweets = [
    { id: '3', text: '新商品のお知らせ', created_at: '2026-08-06T12:00:00.000Z' },
    { id: '1', text: '今日は晴れ', created_at: '2026-08-06T09:00:00.000Z' },
    { id: '2', text: 'セール開催中', created_at: '2026-08-06T10:00:00.000Z' },
  ];
  var matches = judgeTweets(tweets, ['セール', '新商品']);

  return [
    assertEquals_('一致した投稿だけを返す', matches.length, 2),
    assertEquals_('投稿時刻の古い順に並ぶ（1件目）', matches[0].tweet.id, '2'),
    assertEquals_('投稿時刻の古い順に並ぶ（2件目）', matches[1].tweet.id, '3'),
    assertEquals_('一致したキーワードを持つ', matches[0].matched, 'セール'),
    assertEquals_('空配列を渡しても落ちない', judgeTweets([], ['セール']).length, 0),
  ];
}

// ---- 日付まわり ----

function testResolveTargetDate_() {
  var tz = Session.getScriptTimeZone();

  // 23:59 に実行 → その日が対象
  var lateNight = new Date(2026, 7, 6, 23, 59, 0);
  var resolvedLate = Utilities.formatDate(resolveTargetDate(lateNight), tz, 'yyyy-MM-dd');

  // 0:10 に実行（トリガーが日付をまたいだ場合）→ 前日が対象
  var afterMidnight = new Date(2026, 7, 7, 0, 10, 0);
  var resolvedEarly = Utilities.formatDate(resolveTargetDate(afterMidnight), tz, 'yyyy-MM-dd');

  return [
    assertEquals_('23:59 実行ならその日が対象', resolvedLate, '2026-08-06'),
    assertEquals_('0:10 実行なら前日が対象', resolvedEarly, '2026-08-06'),
  ];
}

function testBuildDayWindow_() {
  var targetDate = new Date(2026, 7, 6, 23, 59, 0);
  var now = new Date(2026, 7, 6, 23, 59, 0);
  var window = buildDayWindow(targetDate, now);

  var results = [
    assertTrue_('start は RFC3339 形式のUTC文字列',
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(window.start), window.start),
    assertTrue_('end は RFC3339 形式のUTC文字列',
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(window.end), window.end),
    assertTrue_('start は end より前',
      window.start < window.end, window.start + ' >= ' + window.end),
  ];

  // 実行時刻が日付をまたいでいる場合、end は 24:00 ちょうどになる（未来に伸びない）
  var nextDay = new Date(2026, 7, 7, 0, 10, 0);
  var pastWindow = buildDayWindow(new Date(2026, 7, 6, 12, 0, 0), nextDay);
  results.push(assertTrue_('過去日の end は未来に伸びない',
    pastWindow.end <= toRfc3339Utc_(new Date(2026, 7, 7, 0, 0, 0)), pastWindow.end));

  return results;
}

// ---- OAuth / 設定値の変換 ----

function testPercentEncode_() {
  return [
    assertEquals_('スペースは %20', percentEncode_('a b'), 'a%20b'),
    assertEquals_('記号 ! * \' ( ) もエンコードする',
      percentEncode_("!*'()"), '%21%2A%27%28%29'),
    assertEquals_('非予約文字はそのまま',
      percentEncode_('aZ0-._~'), 'aZ0-._~'),
    assertEquals_('日本語はUTF-8でエンコードする',
      percentEncode_('あ'), '%E3%81%82'),
  ];
}

/**
 * OAuth 1.0a の署名処理を、X 公式ドキュメントに載っている例で検証する。
 * 出典: developer.x.com「Creating a signature」の Consumer key ほか一式。
 *
 * ここが壊れていると API 呼び出しが全滅するため、実際の GAS ランタイム上で
 * HMAC-SHA1・Base64・パーセントエンコードが揃って正しく動くことを確かめている。
 */
function testOAuthSignature_() {
  var params = {
    include_entities: 'true',
    status: 'Hello Ladies + Adding Some Party to the Party!',
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
  };

  var expectedBaseString =
    'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json' +
    '&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog' +
    '%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg' +
    '%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958' +
    '%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb' +
    '%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Adding' +
    '%2520Some%2520Party%2520to%2520the%2520Party%2521';

  var baseString = buildSignatureBaseString_(
    'POST', 'https://api.twitter.com/1.1/statuses/update.json', params);

  var signature = signOAuth_(
    baseString,
    'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE'
  );

  return [
    assertEquals_('署名のベース文字列が公式の例と一致する', baseString, expectedBaseString),
    assertEquals_('HMAC-SHA1 署名が期待値と一致する', signature, 'uWSfWvplHuUNvh17GCqNX7B2vh4='),
  ];
}

function testNormalizeUsername_() {
  return [
    assertEquals_('@ を取り除く', normalizeUsername_('@example'), 'example'),
    assertEquals_('URL からユーザー名を取り出す',
      normalizeUsername_('https://x.com/example'), 'example'),
    assertEquals_('twitter.com のURLにも対応',
      normalizeUsername_('https://twitter.com/example'), 'example'),
    assertEquals_('前後の空白を取り除く', normalizeUsername_('  example  '), 'example'),
    assertEquals_('空文字はそのまま', normalizeUsername_(''), ''),
  ];
}

function testToBoolean_() {
  return [
    assertEquals_('真偽値はそのまま', toBoolean_(true, false), true),
    assertEquals_('文字列 TRUE を解釈する', toBoolean_('TRUE', false), true),
    assertEquals_('文字列 false を解釈する', toBoolean_('false', true), false),
    assertEquals_('空欄なら既定値', toBoolean_('', true), true),
    assertEquals_('解釈できない値なら既定値', toBoolean_('ええと', false), false),
  ];
}

// ---- テスト用の小さなヘルパー ----

function assertEquals_(name, actual, expected) {
  var ok = (actual === expected);
  return {
    name: name,
    ok: ok,
    detail: ok ? '' : '期待値: ' + JSON.stringify(expected) + ' / 実際: ' + JSON.stringify(actual),
  };
}

function assertTrue_(name, condition, detail) {
  return { name: name, ok: !!condition, detail: condition ? '' : String(detail) };
}
