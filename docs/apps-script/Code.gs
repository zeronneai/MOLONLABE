/**
 * Molon Labe Firearms x SunCity Outdoors: the site's mail and sheet script.
 *
 * Paste over the whole of Code.gs in the Apps Script project, set the
 * three values in CONFIG, then Deploy > Manage deployments > edit the
 * existing web app deployment > Version: New version > Deploy. Editing
 * the existing deployment keeps the same URL, so GOOGLE_SCRIPT_URL on the
 * site does not change.
 *
 * The site POSTs one JSON object per event. What this does with each:
 *
 *   order_confirmation   email the customer the finished HTML and text
 *   order_error          email the PROBLEMS list, subject marked
 *   order, inquiry,      email the ROUTINE list
 *   game_full
 *   test_alert           email whichever list it names, marked as a test
 *
 * Every event is also appended to the sheet.
 *
 * WHO RECEIVES AN ALERT
 *
 * The owner sets two lists in the admin under Team & alerts. Each alert
 * arrives carrying the list for its own group as `notify_to`, and its
 * group as `notify_group`. `notify_to` is left out entirely when that
 * list is empty, and then the alert goes to CONFIG.DEFAULT_TO, so an
 * empty list never means an alert sent to nobody.
 *
 * WHAT THE SITE READS BACK
 *
 * { ok: true, delivered_to: [...] } on success. The admin's "Send a test"
 * button reports `delivered_to`, which is how the owner can see the lists
 * are being honoured. { ok: false, error: "..." } on failure; for a
 * customer confirmation the site then tells the buyer their copy did not
 * go and flags it on the order alert.
 */

const CONFIG = {
  // Where an alert goes when its list in Team & alerts is empty. Required.
  DEFAULT_TO: 'owner@example.com',

  // The spreadsheet to log to. Leave blank if this script is bound to the
  // spreadsheet (opened from Extensions > Apps Script inside it).
  SPREADSHEET_ID: '',

  // Sheet tab per kind. If your sheet already has tabs, put their names
  // here; rows are matched to your existing columns BY HEADER NAME, so
  // existing columns keep filling and new fields are added as new columns
  // at the right-hand end rather than shifting anything.
  TABS: {
    order_confirmation: 'Confirmations',
    order: 'Orders',
    inquiry: 'Inquiries',
    order_error: 'Problems',
    game_full: 'Sold out',
    test_alert: 'Tests',
    other: 'Other',
  },

  // Prepended to every order_error subject, so it cannot be mistaken for
  // routine mail in an inbox list or on a lock screen.
  PROBLEM_PREFIX: '[ORDER PROBLEM] ',

  // The sender name on every email this script sends.
  SENDER_NAME: 'Molon Labe Firearms x SunCity Outdoors',
};

// ------------------------------------------------------------------ entry

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return reply_({ ok: false, error: 'The request was not JSON.' });
  }
  if (!data || typeof data.kind !== 'string') {
    return reply_({ ok: false, error: 'The request had no kind.' });
  }

  let result;
  try {
    result = data.kind === 'order_confirmation'
      ? sendConfirmation_(data)
      : sendAlert_(data);
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) };
  }

  // Logged whether or not the email went, so a day the mail quota runs
  // out still leaves a record of every order. A sheet failure is written
  // to the execution log and never turns a sent email into a failure.
  try {
    logToSheet_(data, result);
  } catch (err) {
    console.error('Sheet logging failed: ' + err);
  }

  return reply_(result);
}

// ------------------------------------------------------ the customer copy

function sendConfirmation_(data) {
  const to = cleanAddresses_([data.to])[0];
  if (!to) return { ok: false, error: 'No valid customer address.' };

  const options = {
    htmlBody: String(data.html || ''),
    name: CONFIG.SENDER_NAME,
  };
  // `from` is only usable if this Google account has it as a verified
  // "Send mail as" alias. Otherwise send from the account's own address
  // rather than fail the customer's copy.
  if (data.from && GmailApp.getAliases().indexOf(String(data.from)) !== -1) {
    options.from = String(data.from);
  }
  if (data.reply_to) options.replyTo = String(data.reply_to);

  GmailApp.sendEmail(to, String(data.subject || 'Your order'), String(data.text || ''), options);
  return { ok: true, delivered_to: [to] };
}

// ------------------------------------------------------------- the alerts

function groupFor_(data) {
  // Decided here from the kind as well as read from the payload, so an
  // order problem goes to the problems list even if notify_group were
  // ever missing.
  if (data.kind === 'order_error') return 'problems';
  if (data.kind === 'test_alert') return data.group === 'problems' ? 'problems' : 'routine';
  return data.notify_group === 'problems' ? 'problems' : 'routine';
}

function sendAlert_(data) {
  const group = groupFor_(data);
  let to = cleanAddresses_(Array.isArray(data.notify_to) ? data.notify_to : []);
  if (to.length === 0) to = cleanAddresses_([CONFIG.DEFAULT_TO]);
  if (to.length === 0) {
    return { ok: false, error: 'No recipients: set CONFIG.DEFAULT_TO in the script.' };
  }

  let subject = String(data.subject || data.kind);
  if (group === 'problems' && subject.indexOf(CONFIG.PROBLEM_PREFIX) !== 0) {
    subject = CONFIG.PROBLEM_PREFIX + subject;
  }
  // The site writes the whole body; it is sent exactly as it arrives.
  const body = String(data.summary || JSON.stringify(data, null, 2));

  GmailApp.sendEmail(to.join(','), subject, body, { name: CONFIG.SENDER_NAME });
  return { ok: true, delivered_to: to };
}

function cleanAddresses_(list) {
  const seen = {};
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const a = String(list[i] || '').trim().toLowerCase();
    if (/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(a) && !seen[a]) {
      seen[a] = true;
      out.push(a);
    }
  }
  return out;
}

// -------------------------------------------------------------- the sheet

/**
 * One row per event, in the tab for its kind. Columns are matched by
 * header name, so an existing tab keeps its layout; a field the tab has
 * no column for gets one added at the end.
 */
function logToSheet_(data, result) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const book = CONFIG.SPREADSHEET_ID
      ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    const name = CONFIG.TABS[data.kind] || CONFIG.TABS.other;
    const sheet = book.getSheetByName(name) || book.insertSheet(name);

    const row = flatten_(data);
    row.email_result = result.ok ? 'sent' : 'FAILED: ' + (result.error || '');
    row.delivered_to = (result.delivered_to || []).join(', ');

    const lastCol = sheet.getLastColumn();
    const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      if (headers.indexOf(keys[i]) === -1) headers.push(keys[i]);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.appendRow(headers.map(function (h) {
      return Object.prototype.hasOwnProperty.call(row, h) ? row[h] : '';
    }));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Field names the site keeps for compatibility, shown in the sheet in the
 * shop's words. What a customer buys is a guide, and staff read this
 * sheet, so the old internal names do not become column headings.
 */
const COLUMN_NAMES = {
  spot_numbers: 'guide_numbers',
  total_spots: 'total_guides',
  game: 'drop',
};
const VALUE_WORDS = [
  [/\bspots_not_sold\b/g, 'guides_not_recorded'],
  [/"hold":"spot"/g, '"hold":"guide"'],
];

/** Scalars as they are; lists joined; anything nested as JSON. */
function flatten_(data) {
  const out = {};
  const skip = { html: true, text: true }; // the customer email body itself
  Object.keys(data).forEach(function (key) {
    if (skip[key]) return;
    const v = data[key];
    let cell;
    if (v === null || v === undefined) cell = '';
    else if (Array.isArray(v) && v.every(function (x) { return x === null || typeof x !== 'object'; })) {
      cell = v.join(', ');
    } else if (typeof v === 'object') cell = JSON.stringify(v);
    else cell = v;
    if (typeof cell === 'string') {
      VALUE_WORDS.forEach(function (w) { cell = cell.replace(w[0], w[1]); });
    }
    out[COLUMN_NAMES[key] || key] = cell;
  });
  return out;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------ run by hand

/**
 * Run once from the editor (select it, press Run) after pasting. It asks
 * for the Gmail and Sheets permissions, then sends one test alert to
 * DEFAULT_TO and logs it, so you know both work before the site relies on
 * them.
 */
function setupCheck() {
  const out = doPost({
    postData: {
      contents: JSON.stringify({
        kind: 'test_alert',
        group: 'problems',
        requested_by: 'Apps Script editor',
        notify_group: 'problems',
        subject: 'Test alert (problems) — nothing has happened',
        summary: 'TEST ALERT. NOTHING HAS HAPPENED.\n\nSent from setupCheck() in the Apps Script editor.',
        submitted_at: new Date().toISOString(),
      }),
    },
  });
  console.log(out.getContent());
}
