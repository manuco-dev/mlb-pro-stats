import { getDb } from './_mongo.js';

function isNodeResponse(res) {
  return !!res && typeof res.setHeader === 'function' && typeof res.end === 'function';
}

function jsonResponse(res, status, payload) {
  if (isNodeResponse(res)) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return;
  }
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function textResponse(res, status, text) {
  if (isNodeResponse(res)) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
    return;
  }
  return new Response(text, { status });
}

async function readJsonBody(req) {
  if (typeof req?.json === 'function') return req.json();
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += String(chunk); });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function parseLine(value) {
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeSide(value) {
  if (/^under$/i.test(String(value || ''))) return 'Under';
  if (/^over$/i.test(String(value || ''))) return 'Over';
  return '';
}

function inferMarket(text, pick) {
  const explicit = String(pick?.market || '').trim().toUpperCase();
  if (explicit) return explicit;
  if (/^ML\s+/i.test(text)) return 'ML';
  if (/^Total RUNS\s+/i.test(text) || /^(Over|Under)\s+-?\d/i.test(text)) return 'TOTAL';
  if (/^K\s+/i.test(text)) return 'K';
  if (/^IP\s+/i.test(text)) return 'IP';
  return '';
}

function extractSubject(text, market, pick) {
  const explicit = String(pick?.subject || '').trim();
  if (explicit) return explicit;
  if (market === 'ML') return text.replace(/^ML\s+/i, '').trim();
  if (market === 'K' || market === 'IP') {
    const match = text.match(/^(K|IP)\s+(.+?)\s+(Over|Under)(?:\s+-?\d+(?:\.\d+)?)?$/i);
    return match ? match[2].trim() : '';
  }
  return '';
}

function normalizeText(rawText, market, subject, side, line) {
  const text = String(rawText || '').trim();
  if (market === 'ML' && subject) return `ML ${subject}`;
  if (market === 'TOTAL' && side) return `Total RUNS ${side}${line == null ? '' : ` ${line}`}`;
  if ((market === 'K' || market === 'IP') && subject && side) {
    return `${market} ${subject} ${side}${line == null ? '' : ` ${line}`}`;
  }
  return text;
}

function normalizePick(pick) {
  const rawText = String(pick?.text || '').trim();
  const market = inferMarket(rawText, pick);
  const side = normalizeSide(pick?.side || rawText);
  const line = Number.isFinite(Number(pick?.line)) ? Number(pick.line) : parseLine(rawText);
  const subject = extractSubject(rawText, market, pick);
  return {
    text: normalizeText(rawText, market, subject, side, line),
    market,
    subject,
    side,
    line,
    badge: String(pick?.badge || 'lean'),
    source: String(pick?.source || 'model'),
    reason: String(pick?.reason || ''),
    prob: Number.isFinite(Number(pick?.prob)) ? Number(pick.prob) : null,
    score: Number.isFinite(Number(pick?.score)) ? Number(pick.score) : null
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return textResponse(res, 405, 'Method Not Allowed');
    }
    const body = await readJsonBody(req);
    const rows = Array.isArray(body?.games) ? body.games : [];
    if (!rows.length) {
      return jsonResponse(res, 200, { ok: true, upserts: 0 });
    }
    const db = await getDb();
    const collection = db.collection('picks');
    const now = new Date().toISOString();
    let upserts = 0;
    for (const row of rows) {
      const gameId = String(row?.gameId || '');
      const dateKey = String(row?.dateKey || '');
      if (!gameId || !dateKey) continue;
      const doc = {
        gameId,
        dateKey,
        awayAbr: String(row?.awayAbr || ''),
        homeAbr: String(row?.homeAbr || ''),
        evtIso: String(row?.evtIso || ''),
        edge: Number.isFinite(Number(row?.edge)) ? Number(row.edge) : 0,
        picks: (Array.isArray(row?.picks) ? row.picks : []).map(normalizePick).filter(p => p.text),
        updatedAt: now
      };
      await collection.updateOne(
        { gameId, dateKey },
        {
          $set: doc,
          $setOnInsert: {
            createdAt: now,
            settled: false,
            resultSummary: null
          }
        },
        { upsert: true }
      );
      upserts += 1;
    }
    return jsonResponse(res, 200, { ok: true, upserts });
  } catch (error) {
    return jsonResponse(res, 500, { ok: false, error: error.message });
  }
}
