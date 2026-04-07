async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function safeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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

function currentSeason() {
  return new Date().getFullYear();
}

async function fetchTeamBattingStrikeouts(team, season) {
  const teamId = String(team?.id || '');
  const statsData = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}/statistics?season=${season}`);
  const rootCategories = statsData?.splits?.categories || statsData?.results?.stats?.categories || [];
  const batting = rootCategories.find(cat => cat.name === 'batting');
  const stats = batting?.stats || [];
  const splits = statsData?.results?.splits || statsData?.splits || [];
  const splitMetrics = (splitName) => {
    const splitBatting = (splits.find(split => split.name === splitName)?.categories || []).find(cat => cat.name === 'batting');
    const splitStats = splitBatting?.stats || [];
    const splitStrikeouts = safeNum(splitStats.find(stat => stat.name === 'strikeouts')?.value);
    const splitPlateAppearances = safeNum(splitStats.find(stat => stat.name === 'plateAppearances')?.value);
    const splitGamesPlayed = safeNum(splitStats.find(stat => stat.name === 'teamGamesPlayed')?.value || splitStats.find(stat => stat.name === 'gamesPlayed')?.value);
    return {
      strikeouts: splitStrikeouts,
      plateAppearances: splitPlateAppearances,
      gamesPlayed: splitGamesPlayed,
      kpg: splitGamesPlayed > 0 ? splitStrikeouts / splitGamesPlayed : 0,
      kRate: splitPlateAppearances > 0 ? splitStrikeouts / splitPlateAppearances : 0
    };
  };
  const strikeouts = safeNum(stats.find(stat => stat.name === 'strikeouts')?.value);
  const plateAppearances = safeNum(stats.find(stat => stat.name === 'plateAppearances')?.value);
  const gamesPlayed = safeNum(stats.find(stat => stat.name === 'teamGamesPlayed')?.value || stats.find(stat => stat.name === 'gamesPlayed')?.value);
  const vsLeft = splitMetrics('vs. Left');
  const vsRight = splitMetrics('vs. Right');
  return {
    id: teamId,
    abbreviation: String(team?.abbreviation || ''),
    displayName: String(team?.displayName || ''),
    shortDisplayName: String(team?.shortDisplayName || team?.displayName || ''),
    logo: team?.logos?.[0]?.href || '',
    strikeouts,
    plateAppearances,
    gamesPlayed,
    kpg: gamesPlayed > 0 ? strikeouts / gamesPlayed : 0,
    kRate: plateAppearances > 0 ? strikeouts / plateAppearances : 0,
    vsLeft,
    vsRight
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return textResponse(res, 405, 'Method Not Allowed');
    }
    const base = isNodeResponse(res) ? 'http://localhost' : undefined;
    const url = new URL(req.url, base);
    const season = safeNum(url.searchParams.get('season')) || currentSeason();
    const standings = await fetchJson('https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings');
    const teams = (standings?.children || [])
      .flatMap(child => child?.standings?.entries || [])
      .map(entry => entry?.team)
      .filter(team => team?.id);
    const uniqueTeams = Array.from(new Map(teams.map(team => [String(team.id), team])).values());
    const results = await Promise.allSettled(uniqueTeams.map(team => fetchTeamBattingStrikeouts(team, season)));
    const rows = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .sort((a, b) => b.strikeouts - a.strikeouts || b.kRate - a.kRate || a.displayName.localeCompare(b.displayName));
    return jsonResponse(res, 200, {
      ok: true,
      season,
      teams: rows.map((row, index) => ({
        rank: index + 1,
        ...row
      }))
    });
  } catch (error) {
    return jsonResponse(res, 500, { ok: false, error: error.message });
  }
}
