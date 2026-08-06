/**
 * 認証まわりの診断
 *
 * 401 が出たときに「どこが悪いのか」を切り分けるための機能。
 * 認証情報そのものは表示せず、文字数や形式の特徴だけを見る。
 */

// X Developer Portal が発行する値の、既知の形式
var CREDENTIAL_SHAPES = [
  {
    name: 'X_API_KEY',
    label: 'API Key',
    expectedLength: 25,
    check: function (v) {
      if (/^AAAA/.test(v)) return 'Bearer Token が入っている可能性があります';
      if (v.indexOf('-') !== -1) return 'Access Token が入っている可能性があります';
      return '';
    },
  },
  {
    name: 'X_API_SECRET',
    label: 'API Key Secret',
    expectedLength: 50,
    check: function (v) {
      if (/^AAAA/.test(v)) return 'Bearer Token が入っている可能性があります';
      if (v.indexOf('-') !== -1) return 'Access Token が入っている可能性があります';
      return '';
    },
  },
  {
    name: 'X_ACCESS_TOKEN',
    label: 'Access Token',
    expectedLength: null, // 「ユーザーID-英数字40文字」なので長さは可変
    check: function (v) {
      if (/^AAAA/.test(v)) return 'Bearer Token が入っている可能性があります';
      if (!/^\d+-/.test(v)) return '「数字-英数字」の形になっていません。Access Token ではない可能性があります';
      return '';
    },
  },
  {
    name: 'X_ACCESS_TOKEN_SECRET',
    label: 'Access Token Secret',
    expectedLength: 45,
    check: function (v) {
      if (/^AAAA/.test(v)) return 'Bearer Token が入っている可能性があります';
      if (v.indexOf('-') !== -1) return 'Access Token が入っている可能性があります';
      return '';
    },
  },
];

/**
 * メニューから呼ぶ診断。結果をダイアログとログの両方に出す。
 */
function diagnoseAuth() {
  var report = buildDiagnosisReport_();

  Logger.log(report);
  SpreadsheetApp.getUi().alert('認証診断', report, SpreadsheetApp.getUi().ButtonSet.OK);
}

function buildDiagnosisReport_() {
  var lines = [];

  lines.push('【1】認証情報の形式');
  lines = lines.concat(checkCredentialShapes_());

  // 通信は1ホストにつき1回だけ行い、その結果を表示と判定の両方で使い回す
  var probes = probeHosts_();

  lines.push('');
  lines.push('【2】ホスト別の接続結果');
  lines = lines.concat(formatProbes_(probes));

  lines.push('');
  lines.push('【3】判定');
  lines = lines.concat(summarize_(probes));

  return lines.join('\n');
}

/** 認証情報の文字数・形式だけを確認する（値そのものは表示しない） */
function checkCredentialShapes_() {
  var props = PropertiesService.getScriptProperties();
  var lines = [];

  for (var i = 0; i < CREDENTIAL_SHAPES.length; i++) {
    var shape = CREDENTIAL_SHAPES[i];
    var raw = props.getProperty(shape.name);

    if (!raw) {
      lines.push('❌ ' + shape.label + ': 未設定（' + shape.name + '）');
      continue;
    }

    var value = String(raw).trim();
    var warnings = [];

    if (String(raw) !== value) {
      warnings.push('前後に空白か改行が入っています');
    }
    if (shape.expectedLength && value.length !== shape.expectedLength) {
      warnings.push('通常は' + shape.expectedLength + '文字ですが' + value.length + '文字です');
    }
    var shapeWarning = shape.check(value);
    if (shapeWarning) warnings.push(shapeWarning);

    lines.push(
      (warnings.length > 0 ? '⚠️ ' : '✅ ') + shape.label + ': ' + value.length + '文字' +
      (warnings.length > 0 ? '\n　　→ ' + warnings.join('/ ') : '')
    );
  }
  return lines;
}

/**
 * ホストを変えて /2/users/me を叩き、どれが通るかを確かめる。
 * リダイレクトは追わずに、そのまま結果として見せる。
 *
 * @return {Array<Object>} [{host, result}, ...]
 */
function probeHosts_() {
  var hosts = ['https://api.twitter.com', 'https://api.x.com'];
  var probes = [];

  for (var i = 0; i < hosts.length; i++) {
    probes.push({ host: hosts[i], result: probeUrl_(hosts[i] + '/2/users/me') });
  }
  return probes;
}

function formatProbes_(probes) {
  var lines = [];

  for (var i = 0; i < probes.length; i++) {
    var host = probes[i].host;
    var result = probes[i].result;

    var note = '';
    if (result.code === 200) note = ' ← 成功';
    else if (result.code >= 300 && result.code < 400) note = ' ← リダイレクト先: ' + result.location;
    else if (result.code === 401) note = ' ← 認証エラー';
    else if (result.code === 403) note = ' ← 権限エラー';

    lines.push((result.code === 200 ? '✅ ' : '❌ ') + host + ': HTTP ' + result.code + note);

    if (result.code !== 200 && result.body) {
      lines.push('　　' + result.body.slice(0, 160));
    }
  }
  return lines;
}

function probeUrl_(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: buildOAuthHeader_('GET', url, {}) },
      muteHttpExceptions: true,
      followRedirects: false,
    });
    var headers = response.getHeaders();

    return {
      code: response.getResponseCode(),
      body: response.getContentText(),
      location: headers.Location || headers.location || '(不明)',
    };
  } catch (err) {
    return { code: 0, body: String(err.message || err), location: '' };
  }
}

/** 上の結果をふまえて、次に何をすればよいかを示す */
function summarize_(probes) {
  var working = null;

  for (var i = 0; i < probes.length; i++) {
    if (probes[i].result.code === 200) {
      working = probes[i].host;
      break;
    }
  }

  if (working) {
    return [
      '✅ ' + working + ' で認証に成功しました。',
      X_API_BASE.indexOf(working) === 0
        ? '　　設定は正しいので、そのまま接続テストへ進んでください。'
        : '　　XApiClient.gs の X_API_BASE を ' + working + '/2 に変更してください。',
    ];
  }

  return [
    'どちらのホストでも認証できませんでした。次の順に確認してください。',
    '',
    '1. 上の【1】に ⚠️ が付いていれば、その項目を貼り直す',
    '2. Developer Portal の Keys and tokens で',
    '　 Access Token と Secret を「Regenerate」して貼り直す',
    '　（権限を Read and write に変えた場合は再生成が必須です）',
    '3. アプリが Project に紐づいているか確認する',
    '　（Project に属さないアプリでは API v2 を使えません）',
  ];
}
