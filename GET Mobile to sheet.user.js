// ==UserScript==
// @name         GET Mobile → Google Sheet
// @namespace    personal
// @version      1.1
// @description  Scrapes the CBORD GET transaction history table and syncs it to a Google Sheet
// @match        https://get.cbord.com/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

// NOTE: the ==UserScript== line above MUST be the very first line of the file.
// Delete Tampermonkey's template completely before pasting this in.

(function () {
  'use strict';

  const ENDPOINT = 'EXAMPLE';
  const SECRET   = 'EXAMPLE1234';

  const badge = makeBadge();
  let lastPayloadHash = null;
  let debounce = null;

  const table = findHistoryTable();
  if (!table) {
    console.log('[GETsync] no history table on this page');
    badge.remove();
    return;
  }

  sync();

  new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(sync, 800);
  }).observe(table, { childList: true, subtree: true });

  badge.addEventListener('click', function () {
    lastPayloadHash = null;
    sync();
  });

  function sync() {
    const rows = scrape(table);
    console.log('[GETsync] scraped rows:', rows.length, rows[0]);

    if (!rows.length) {
      setBadge('no rows found', '#8a6d3b');
      return;
    }

    const hash = rows.length + ':' + rows[0].key + ':' + rows[rows.length - 1].key;
    if (hash === lastPayloadHash) return;
    lastPayloadHash = hash;

    setBadge('syncing ' + rows.length + '…', '#555');

    GM_xmlhttpRequest({
      method: 'POST',
      url: ENDPOINT,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ secret: SECRET, rows: rows }),
      onload: function (res) {
        console.log('[GETsync] status:', res.status);
        console.log('[GETsync] finalUrl:', res.finalUrl);
        console.log('[GETsync] body:', String(res.responseText).slice(0, 800));

        let out;
        try { out = JSON.parse(res.responseText); }
        catch (e) {
          setBadge('bad response (see console)', '#a94442');
          return;
        }

        if (!out.ok) {
          setBadge('error: ' + out.error, '#a94442');
          return;
        }
        setBadge(out.added + ' new / ' + out.received + ' seen', '#3c763d');
      },
      onerror: function (res) {
        console.log('[GETsync] onerror', res);
        lastPayloadHash = null;
        setBadge('network error', '#a94442');
      },
      ontimeout: function () {
        lastPayloadHash = null;
        setBadge('timed out', '#a94442');
      },
      timeout: 20000
    });
  }

  function findHistoryTable() {
    const tables = document.querySelectorAll('table');
    for (let i = 0; i < tables.length; i++) {
      const headRow = tables[i].querySelector('tr');
      if (!headRow) continue;
      const head = Array.prototype.map
        .call(headRow.cells, function (c) { return c.textContent.trim().toUpperCase(); })
        .join('|');
      if (head.indexOf('DATE') !== -1 && head.indexOf('AMOUNT') !== -1) {
        return tables[i];
      }
    }
    return null;
  }

  function scrape(tbl) {
    const out = [];

    Array.prototype.forEach.call(tbl.rows, function (tr) {
      if (tr.cells.length < 4) return;
      if (tr.querySelector('th')) return;

      const account = text(tr.cells[0]);
      const rawDate = text(tr.cells[1]);
      const details = text(tr.cells[2]);
      const rawAmt  = text(tr.cells[3]);

      const iso = parseTimestamp(rawDate);
      if (!iso) return;

      const parsed = parseAmount(rawAmt);

      out.push({
        key: [account, iso, rawAmt].join('|'),
        account: account,
        timestamp: iso,
        details: details,
        amount: parsed.amount,
        meals: parsed.meals
      });
    });

    return out;
  }

  function parseTimestamp(s) {
    const m = s.match(
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i
    );
    if (!m) return null;

    const mo = pad(m[1]);
    const d  = pad(m[2]);
    const y  = m[3].length === 2 ? '20' + m[3] : m[3];
    const mi = m[5];
    const se = m[6] || '00';
    let h = parseInt(m[4], 10);

    if (m[7]) {
      const pm = m[7].toUpperCase() === 'PM';
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
    }

    return y + '-' + mo + '-' + d + 'T' + pad(h) + ':' + mi + ':' + se;
  }

  function parseAmount(s) {
    const t = s.replace(/\s+/g, ' ').trim();
    const sign = /^-|^\(/.test(t) ? -1 : 1;

    const money = t.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    if (money) {
      return { amount: sign * parseFloat(money[1].replace(/,/g, '')), meals: null };
    }

    const count = t.match(/([\d,]+(?:\.\d+)?)/);
    if (count) {
      return { amount: null, meals: sign * parseFloat(count[1].replace(/,/g, '')) };
    }

    return { amount: null, meals: null };
  }

  function text(cell) {
    return cell.textContent.replace(/\s+/g, ' ').trim();
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function makeBadge() {
    const el = document.createElement('div');
    el.textContent = 'GET sync';
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '14px',
      right: '14px',
      zIndex: '2147483647',
      padding: '6px 11px',
      borderRadius: '13px',
      background: '#555',
      color: '#fff',
      font: '12px/1.3 system-ui, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 1px 6px rgba(0,0,0,.3)',
      userSelect: 'none'
    });
    el.title = 'Click to re-sync';
    document.body.appendChild(el);
    return el;
  }

  function setBadge(msg, color) {
    badge.textContent = msg;
    badge.style.background = color;
  }
})();
