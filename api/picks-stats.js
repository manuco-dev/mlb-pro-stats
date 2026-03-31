import { getDb } from './_mongo.js';

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function parseLine(value) {
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function lastName(full) {
  return String(full || '').trim().split(/\s+/).slice(-1)[0] || '';
}

function normalizeSide(value) {
  if (/^under$/i.test(String(value || ''))) return 'Under';
  if (/^over$/i.test(String(value || ''))) return 'Over';
  return '';
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function parseInningsToDecimal(value) {
  const text = String(value || '0').trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text) && !text.includes('/')) {
    const [whole, frac = '0'] = text.split('.');
    const outs = Number(frac[0] || 0);
    if (outs >= 0 && outs <= 2) return Number(whole) + (outs / 3);
    return Number(text) || 0;
  }
  return Number(text) || 0;
}

function getSummaryPlayerBlocks(summary) {
  if (Array.isArray(summary?.players) && summary.players.length) return summary.players;
  if (Array.isArray(summary?.boxscore?.players) && summary.boxscore.players.length) return summary.boxscore.players;
  return [];
}

function findBlockIndex(block, matcher) {
  const collections = [block?.labels, block?.keys, block?.names, block?.headers];
  for (const items of collections) {
    const idx = (items || []).findIndex(value => matcher(String(value || '')));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractPitchingLine(block, athlete) {
  const stats = athlete?.stats || [];
  const ipIdx = findBlockIndex(block, value => /^ip$/i.test(value) || /innings/i.test(value));
  const kIdx = findBlockIndex(block, value => /^k$/i.test(value) || /^so$/i.test(value) || /strikeouts?/i.test(value));
  const innings = ipIdx >= 0 ? String(stats[ipIdx] ?? '0.0') : '0.0';
  const strikeouts = kIdx >= 0 ? Number(stats[kIdx] ?? 0) || 0 : 0;
  return {
    innings,
    inningsDec: parseInningsToDecimal(innings),
    strikeouts
  };
}

function buildStarterMap(summary) {
  const starterMap = new Map();
  const playerBlocks = getSummaryPlayerBlocks(summary);
  for (const teamBlock of playerBlocks) {
    const pitchingBlock = (teamBlock?.statistics || []).find(stat => /pitch/i.test(String(stat?.type || stat?.name || stat?.displayName || '')));
    if (!pitchingBlock) continue;
    for (const athlete of (pitchingBlock?.athletes || [])) {
      if (!athlete?.starter) continue;
      const name = athlete?.athlete?.displayName || athlete?.athlete?.shortName || '';
      const data = extractPitchingLine(pitchingBlock, athlete);
      const keys = [name, athlete?.athlete?.shortName, lastName(name)];
      for (const key of keys) {
        const normalized = normalizeKey(key);
        if (normalized) starterMap.set(normalized, data);
      }
    }
  }
  return starterMap;
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

function parsePickMeta(pick) {
  const rawText = String(pick?.text || '').trim();
  const market = inferMarket(rawText, pick);
  const side = normalizeSide(pick?.side || rawText);
  const explicitLine = Number.isFinite(Number(pick?.line)) ? Number(pick.line) : null;
  const line = explicitLine ?? parseLine(rawText);
  let subject = String(pick?.subject || '').trim();
  if (!subject && market === 'ML') {
    subject = rawText.replace(/^ML\s+/i, '').trim();
  }
  if (!subject && (market === 'K' || market === 'IP')) {
    const match = rawText.match(/^(K|IP)\s+(.+?)\s+(Over|Under)(?:\s+-?\d+(?:\.\d+)?)?$/i);
    if (match) subject = match[2].trim();
  }
  const text = (() => {
    if (market === 'ML' && subject) return `ML ${subject}`;
    if (market === 'TOTAL' && side) return `Total RUNS ${side}${line == null ? '' : ` ${line}`}`;
    if ((market === 'K' || market === 'IP') && subject && side) return `${market} ${subject} ${side}${line == null ? '' : ` ${line}`}`;
    return rawText;
  })();
  return { text, market, side, line, subject };
}

function comparePickResult(side, actual, line) {
  if (line == null || !side || !Number.isFinite(actual)) return 'ungraded';
  if (Math.abs(actual - line) <= 1e-9) return 'push';
  if (side === 'Over') return actual > line ? 'win' : 'loss';
  if (side === 'Under') return actual < line ? 'win' : 'loss';
  return 'ungraded';
}

function evaluatePick(pick, finalData, starterMap) {
  const meta = parsePickMeta(pick);
  const totalRuns = Number(finalData?.totalRuns || 0);
  const winnerAbr = String(finalData?.winnerAbr || '');
  if (meta.market === 'ML') {
    return { ...meta, result: winnerAbr === meta.subject ? 'win' : 'loss' };
  }
  if (meta.market === 'TOTAL') {
    return { ...meta, result: comparePickResult(meta.side, totalRuns, meta.line), actual: totalRuns, actualDisplay: String(totalRuns) };
  }
  if (meta.market === 'K' || meta.market === 'IP') {
    const starter = starterMap.get(normalizeKey(meta.subject));
    if (!starter) return { ...meta, result: 'ungraded' };
    const actual = meta.market === 'K' ? Number(starter.strikeouts || 0) : Number(starter.inningsDec || 0);
    return {
      ...meta,
      result: comparePickResult(meta.side, actual, meta.line),
      actual,
      actualDisplay: meta.market === 'IP' ? starter.innings : String(actual)
    };
  }
  return { ...meta, result: 'ungraded' };
}

function summarizeResults(results) {
  const graded = results.filter(result => result.result !== 'ungraded').length;
  const wins = results.filter(result => result.result === 'win').length;
  const losses = results.filter(result => result.result === 'loss').length;
  const pushes = results.filter(result => result.result === 'push').length;
  const ungraded = results.filter(result => result.result === 'ungraded').length;
  return {
    picks: results.length,
    graded,
    wins,
    losses,
    pushes,
    ungraded,
    accuracy: graded ? Number((wins / graded).toFixed(3)) : null
  };
}

function emptyStats() {
  return { picks: 0, graded: 0, wins: 0, losses: 0, pushes: 0, ungraded: 0, accuracy: null };
}

function registerStats(bucket, key, result) {
  const safeKey = String(key || 'otros');
  if (!bucket[safeKey]) bucket[safeKey] = emptyStats();
  bucket[safeKey].picks += 1;
  if (result.result === 'win') {
    bucket[safeKey].wins += 1;
    bucket[safeKey].graded += 1;
  } else if (result.result === 'loss') {
    bucket[safeKey].losses += 1;
    bucket[safeKey].graded += 1;
  } else if (result.result === 'push') {
    bucket[safeKey].pushes += 1;
    bucket[safeKey].graded += 1;
  } else {
    bucket[safeKey].ungraded += 1;
  }
}

function finalizeBucket(bucket) {
  for (const value of Object.values(bucket)) {
    value.accuracy = value.graded ? Number((value.wins / value.graded).toFixed(3)) : null;
  }
  return bucket;
}

async function settlePendingDoc(collection, doc) {
  const summary = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${doc.gameId}`);
  const state = summary?.header?.competitions?.[0]?.status?.type?.state || '';
  if (state !== 'post') return { updated: false, skipped: true };
  const competitors = summary?.header?.competitions?.[0]?.competitors || [];
  const away = competitors.find(c => c.homeAway === 'away') || {};
  const home = competitors.find(c => c.homeAway === 'home') || {};
  const awayScore = Number(away?.score || 0);
  const homeScore = Number(home?.score || 0);
  const winnerAbr = awayScore > homeScore ? away?.team?.abbreviation : home?.team?.abbreviation;
  const starterMap = buildStarterMap(summary);
  const finalData = { totalRuns: awayScore + homeScore, winnerAbr: String(winnerAbr || '') };
  const results = (doc.picks || []).map(pick => ({
    ...evaluatePick(pick, finalData, starterMap),
    badge: String(pick?.badge || 'lean'),
    source: String(pick?.source || 'model')
  }));
  const resultSummary = summarizeResults(results);
  await collection.updateOne(
    { _id: doc._id },
    {
      $set: {
        settled: true,
        settledAt: new Date().toISOString(),
        resultSummary: { ...resultSummary, totalRuns: finalData.totalRuns, winnerAbr: finalData.winnerAbr },
        results
      }
    }
  );
  return { updated: true };
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const db = await getDb();
    const collection = db.collection('picks');
    const docs = await collection.find({ settled: { $ne: true } }).sort({ dateKey: -1, updatedAt: -1 }).limit(24).toArray();
    let updated = 0;
    const settleErrors = [];
    for (let i = 0; i < docs.length; i += 4) {
      const batch = docs.slice(i, i + 4);
      const results = await Promise.allSettled(batch.map(doc => settlePendingDoc(collection, doc)));
      for (let j = 0; j < results.length; j += 1) {
        const result = results[j];
        const doc = batch[j];
        if (result.status === 'fulfilled') {
          if (result.value?.updated) updated += 1;
        } else {
          settleErrors.push({
            gameId: String(doc?.gameId || ''),
            message: String(result.reason?.message || 'settle-error')
          });
        }
      }
    }
    const pending = await collection.countDocuments({ settled: { $ne: true } });
    const allDocs = await collection.find({}).sort({ dateKey: -1, updatedAt: -1, settledAt: -1 }).toArray();
    const settledDocs = allDocs.filter(doc => doc?.settled === true);
    const summary = { games: settledDocs.length, ...emptyStats() };
    const byMarket = {};
    const bySource = {};
    const recent = [];
    const history = [];
    for (const doc of settledDocs) {
      recent.push({
        gameId: String(doc?.gameId || ''),
        dateKey: String(doc?.dateKey || ''),
        awayAbr: String(doc?.awayAbr || ''),
        homeAbr: String(doc?.homeAbr || ''),
        settledAt: String(doc?.settledAt || ''),
        resultSummary: doc?.resultSummary || {}
      });
    }
    for (const doc of allDocs) {
      const settled = doc?.settled === true;
      const picks = settled
        ? (Array.isArray(doc?.results) ? doc.results : [])
        : (Array.isArray(doc?.picks) ? doc.picks.map(pick => ({
            text: String(pick?.text || ''),
            market: String(pick?.market || ''),
            side: String(pick?.side || ''),
            line: Number.isFinite(Number(pick?.line)) ? Number(pick.line) : null,
            result: 'ungraded',
            actualDisplay: '',
            badge: String(pick?.badge || 'lean'),
            source: String(pick?.source || 'model')
          })) : []);
      history.push({
        gameId: String(doc?.gameId || ''),
        dateKey: String(doc?.dateKey || ''),
        awayAbr: String(doc?.awayAbr || ''),
        homeAbr: String(doc?.homeAbr || ''),
        settledAt: String(doc?.settledAt || ''),
        updatedAt: String(doc?.updatedAt || ''),
        settled,
        resultSummary: doc?.resultSummary || summarizeResults(picks),
        results: picks.map(result => ({
          text: String(result?.text || ''),
          market: String(result?.market || ''),
          side: String(result?.side || ''),
          line: Number.isFinite(Number(result?.line)) ? Number(result.line) : null,
          result: String(result?.result || 'ungraded'),
          actualDisplay: String(result?.actualDisplay || ''),
          badge: String(result?.badge || 'lean'),
          source: String(result?.source || 'model')
        }))
      });
      for (const result of picks) {
        summary.picks += 1;
        if (result.result === 'win') {
          summary.wins += 1;
          summary.graded += 1;
        } else if (result.result === 'loss') {
          summary.losses += 1;
          summary.graded += 1;
        } else if (result.result === 'push') {
          summary.pushes += 1;
          summary.graded += 1;
        } else {
          summary.ungraded += 1;
        }
        registerStats(byMarket, result.market || 'otros', result);
        registerStats(bySource, result.source || 'model', result);
      }
    }
    summary.accuracy = summary.graded ? Number((summary.wins / summary.graded).toFixed(3)) : null;
    return new Response(JSON.stringify({
      ok: true,
      updated,
      pending,
      settleErrors,
      summary,
      byMarket: finalizeBucket(byMarket),
      bySource: finalizeBucket(bySource),
      recent: recent.slice(0, 15),
      history: history.slice(0, 240)
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
