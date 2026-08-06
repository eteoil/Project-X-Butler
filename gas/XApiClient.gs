/**
 * X API v2 クライアント（OAuth 1.0a ユーザー認証）
 *
 * リポストには「アプリだけの認証（Bearer）」では足りず、アカウント本人としての
 * ユーザー認証が必要になる。OAuth 1.0a なら開発者ポータルで発行した4つのキーを
 * そのまま使えて、トークンの有効期限も更新処理もないため、この用途では一番簡単。
 */

var X_API_BASE = 'https://api.x.com/2';

/**
 * ユーザー名（@なし）から数値のユーザーIDを取得する。
 * @param {string} username
 * @return {string} ユーザーID
 */
function getUserIdByUsername(username) {
  var res = xApiRequest_('GET', X_API_BASE + '/users/by/username/' + encodeURIComponent(username));

  if (res.errors && res.errors.length > 0 && !res.data) {
    throw new Error('アカウント「@' + username + '」が見つかりません: ' + res.errors[0].detail);
  }
  if (!res.data || !res.data.id) {
    throw new Error('アカウント「@' + username + '」のユーザーID取得に失敗しました。');
  }
  return res.data.id;
}

/**
 * 認証しているアカウント（＝リポストする側）のユーザーIDを取得する。
 * 毎回問い合わせる必要はないのでスクリプトプロパティに覚えておく。
 * @return {string} ユーザーID
 */
function getMyUserId() {
  var props = PropertiesService.getScriptProperties();
  var cached = props.getProperty('X_MY_USER_ID');
  if (cached) return cached;

  var res = xApiRequest_('GET', X_API_BASE + '/users/me');
  if (!res.data || !res.data.id) {
    throw new Error('自分のユーザーID取得に失敗しました。認証情報を確認してください。');
  }
  props.setProperty('X_MY_USER_ID', res.data.id);
  props.setProperty('X_MY_USERNAME', res.data.username || '');
  return res.data.id;
}

/**
 * 指定ユーザーの、指定した時間帯の投稿を取得する。
 *
 * @param {string} userId 対象アカウントのユーザーID
 * @param {Object} window {start: RFC3339文字列, end: RFC3339文字列}
 * @param {Object} options {includeReplies: boolean}
 * @return {Array<Object>} 投稿の配列 [{id, text, created_at}, ...]
 */
function fetchTweetsInWindow(userId, window, options) {
  options = options || {};

  // リポストしたものを二重にリポストしても意味がないので retweets は常に除外する
  var exclude = options.includeReplies ? 'retweets' : 'retweets,replies';

  var tweets = [];
  var paginationToken = null;
  var pageLimit = 5; // 1日分なら通常1ページで足りる。暴走防止の上限。

  for (var page = 0; page < pageLimit; page++) {
    var params = {
      'max_results': '100',
      'start_time': window.start,
      'end_time': window.end,
      'exclude': exclude,
      'tweet.fields': 'created_at',
    };
    if (paginationToken) params['pagination_token'] = paginationToken;

    var res = xApiRequest_('GET', X_API_BASE + '/users/' + userId + '/tweets', params);

    if (res.data && res.data.length) {
      tweets = tweets.concat(res.data);
    }

    paginationToken = res.meta && res.meta.next_token;
    if (!paginationToken) break;
  }

  return tweets;
}

/**
 * 指定した投稿をリポストする。
 *
 * @param {string} myUserId リポストする側（自分）のユーザーID
 * @param {string} tweetId リポストしたい投稿のID
 * @return {Object} {retweeted: boolean}
 */
function repostTweet(myUserId, tweetId) {
  var res = xApiRequest_(
    'POST',
    X_API_BASE + '/users/' + myUserId + '/retweets',
    null,
    { tweet_id: String(tweetId) }
  );

  if (!res.data) {
    throw new Error('リポストのレスポンスが不正です: ' + JSON.stringify(res));
  }
  return res.data;
}

// ---- ここから下は OAuth 署名まわりの内部処理 ----

/**
 * X API にリクエストを送り、JSON を返す。
 *
 * @param {string} method 'GET' または 'POST'
 * @param {string} url クエリ文字列を含まないURL
 * @param {Object} queryParams クエリパラメータ（省略可）
 * @param {Object} bodyObj JSONボディ（POST時のみ、省略可）
 * @return {Object} パース済みレスポンス
 */
function xApiRequest_(method, url, queryParams, bodyObj) {
  queryParams = queryParams || {};

  var options = {
    method: method.toLowerCase(),
    headers: { Authorization: buildOAuthHeader_(method, url, queryParams) },
    muteHttpExceptions: true,
  };
  if (bodyObj) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(bodyObj);
  }

  var response = UrlFetchApp.fetch(url + buildQueryString_(queryParams), options);
  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 429) {
    throw new Error('X API のレート制限に達しました。しばらく待ってから再実行してください。');
  }
  if (code === 401 || code === 403) {
    throw new Error(
      'X API に拒否されました（HTTP ' + code + '）。認証情報、またはアプリの権限設定' +
      '（Read and write が必要）を確認してください。応答: ' + body
    );
  }
  if (code >= 400) {
    throw new Error('X API エラー（HTTP ' + code + '）: ' + body);
  }

  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error('X API の応答を解析できませんでした: ' + body);
  }
}

/**
 * OAuth 1.0a の Authorization ヘッダーを組み立てる。
 *
 * 署名対象に含めるのは「クエリパラメータ + oauth_* パラメータ」まで。
 * JSONボディは（フォーム形式ではないので）署名に含めない、というのが仕様。
 */
function buildOAuthHeader_(method, url, queryParams) {
  var creds = getCredentials_();

  var oauthParams = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: Utilities.getUuid().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // 署名文字列は「クエリと oauth_* をまとめて、キー名順に並べたもの」から作る
  var allParams = {};
  var key;
  for (key in queryParams) allParams[key] = queryParams[key];
  for (key in oauthParams) allParams[key] = oauthParams[key];

  var baseString = buildSignatureBaseString_(method, url, allParams);
  oauthParams.oauth_signature = signOAuth_(baseString, creds.apiSecret, creds.accessSecret);

  return 'OAuth ' + Object.keys(oauthParams).sort().map(function (k) {
    return percentEncode_(k) + '="' + percentEncode_(oauthParams[k]) + '"';
  }).join(', ');
}

/**
 * 署名のもとになる文字列（signature base string）を作る。
 * 外部に依存しない純粋な処理なので、Test.gs で公式の例と突き合わせて検証している。
 *
 * @param {string} method HTTPメソッド
 * @param {string} url クエリ文字列を含まないURL
 * @param {Object} allParams クエリと oauth_* をまとめたもの
 * @return {string}
 */
function buildSignatureBaseString_(method, url, allParams) {
  var paramString = Object.keys(allParams).sort().map(function (k) {
    return percentEncode_(k) + '=' + percentEncode_(allParams[k]);
  }).join('&');

  return [
    method.toUpperCase(),
    percentEncode_(url),
    percentEncode_(paramString),
  ].join('&');
}

/**
 * ベース文字列に HMAC-SHA1 で署名し、Base64 で返す。
 *
 * @param {string} baseString
 * @param {string} apiSecret コンシューマーシークレット
 * @param {string} accessSecret アクセストークンシークレット
 * @return {string} Base64エンコードされた署名
 */
function signOAuth_(baseString, apiSecret, accessSecret) {
  var signingKey = percentEncode_(apiSecret) + '&' + percentEncode_(accessSecret);

  return Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey)
  );
}

function buildQueryString_(queryParams) {
  var keys = Object.keys(queryParams);
  if (keys.length === 0) return '';

  return '?' + keys.map(function (k) {
    return percentEncode_(k) + '=' + percentEncode_(queryParams[k]);
  }).join('&');
}

/**
 * RFC 3986 準拠のパーセントエンコード。
 * encodeURIComponent は ! * ' ( ) を変換しないので、その分を補う。
 */
function percentEncode_(value) {
  return encodeURIComponent(String(value)).replace(/[!*'()]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
