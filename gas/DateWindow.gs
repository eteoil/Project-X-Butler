/**
 * 「その日」の範囲計算
 *
 * GAS の時間主導型トリガーには ±15分程度のゆらぎがあり、23:59 に設定しても
 * 日付をまたいで 0:05 頃に動くことがある。そのまま「今日」を対象にすると
 * 空振りするので、実行時刻から「どの日を処理すべきか」を判断する。
 */

/**
 * 実行時刻をもとに、処理対象の日付を決める。
 * 深夜〜午前中に動いた場合は、トリガーが日付をまたいだものとみなして前日を対象にする。
 *
 * @param {Date} now 実行時刻
 * @return {Date} 対象日（その日の任意の時刻を指す Date）
 */
function resolveTargetDate(now) {
  var hour = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), 'H'));

  if (hour < 12) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  return now;
}

/**
 * 対象日の 0:00 〜 24:00（ただし未来にはしない）を、X API に渡せる
 * RFC3339 形式のUTC文字列で返す。
 *
 * @param {Date} targetDate 対象日
 * @param {Date} now 実行時刻
 * @return {Object} {start: string, end: string}
 */
function buildDayWindow(targetDate, now) {
  var start = startOfDayLocal_(targetDate);
  var end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  // X API は「現在時刻より10秒以上前」の end_time しか受け付けないため、余裕をみて1分引く
  var latestAllowed = new Date(now.getTime() - 60 * 1000);
  if (end.getTime() > latestAllowed.getTime()) {
    end = latestAllowed;
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error('対象期間の計算結果が不正です。実行時刻が対象日より前になっていないか確認してください。');
  }

  return {
    start: toRfc3339Utc_(start),
    end: toRfc3339Utc_(end),
  };
}

/** 対象日の 0:00（スクリプトのタイムゾーン基準）を返す */
function startOfDayLocal_(date) {
  var parts = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd').split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
}

function toRfc3339Utc_(date) {
  return Utilities.formatDate(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/** ログ表示用に「2026-08-06」形式で返す */
function formatDateLabel(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
