/**
 * キーワード判定
 *
 * 外部サービスに一切依存しない純粋な処理なので、Test.gs から単体でテストできる。
 */

/**
 * 本文にキーワードのいずれかが含まれるかを判定する。
 * 英字は大文字・小文字を区別しない。
 *
 * @param {string} text 投稿本文
 * @param {Array<string>} keywords キーワード一覧
 * @return {string|null} 最初に一致したキーワード。一致しなければ null
 */
function matchKeyword(text, keywords) {
  if (!text || !keywords) return null;

  var haystack = String(text).toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    var keyword = String(keywords[i]).trim();
    if (!keyword) continue;
    if (haystack.indexOf(keyword.toLowerCase()) !== -1) {
      return keywords[i];
    }
  }
  return null;
}

/**
 * 投稿の配列から、キーワードに一致したものだけを取り出す。
 * 投稿時刻の古い順に並べ替えて返すので、リポストの順番も時系列になる。
 *
 * @param {Array<Object>} tweets 投稿の配列
 * @param {Array<string>} keywords キーワード一覧
 * @return {Array<Object>} [{tweet, matched}, ...]
 */
function judgeTweets(tweets, keywords) {
  var matches = [];

  for (var i = 0; i < (tweets || []).length; i++) {
    var tweet = tweets[i];
    var matched = matchKeyword(tweet.text, keywords);
    if (matched) {
      matches.push({ tweet: tweet, matched: matched });
    }
  }

  matches.sort(function (a, b) {
    return String(a.tweet.created_at || '').localeCompare(String(b.tweet.created_at || ''));
  });

  return matches;
}
