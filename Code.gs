/**
 * GET Mobile -> Google Sheet receiver
 *
 * IMPORTANT: every function here must sit at the top level of the file.
 * Do not wrap them inside another function (e.g. myFunction) — Apps Script
 * can only find and run top-level functions.
 */

const SHEET_NAME = 'EXAMPLE';
const SECRET = 'EXAMPLE123';

function doGet() {
  return reply({ ok: true, status: 'endpoint alive', sheet: getSheet().getName() });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SECRET) {
      return reply({ ok: false, error: 'bad secret' });
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    const sheet = getSheet();

    // Build a set of keys already in the sheet so we only append new activity.
    const lastRow = sheet.getLastRow();
    const seen = new Set();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .forEach(function (r) { seen.add(String(r[0])); });
    }

    const capturedAt = new Date();
    const toAdd = [];

    rows.forEach(function (r) {
      if (!r.key || seen.has(String(r.key))) return;
      seen.add(String(r.key));
      toAdd.push([
        r.key,
        r.account || '',
        r.timestamp ? new Date(r.timestamp) : '',
        r.details || '',
        r.amount === null || r.amount === undefined ? '' : r.amount,
        r.meals === null || r.meals === undefined ? '' : r.meals,
        capturedAt
      ]);
    });

    if (toAdd.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 7).setValues(toAdd);
      // Keep the log in chronological order.
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).sort({ column: 3, ascending: true });
    }

    return reply({ ok: true, received: rows.length, added: toAdd.length });

  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Key', 'Account', 'Timestamp', 'Details', 'Amount', 'Meals', 'Captured At'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('C:C').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange('G:G').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange('E:E').setNumberFormat('$#,##0.00');
    sheet.setColumnWidth(1, 60);
  }

  return sheet;
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
