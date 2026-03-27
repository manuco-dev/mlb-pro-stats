import os
import json
from datetime import datetime
from urllib.parse import urlencode
import requests
from flask import Flask, request, send_file, Response
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__, static_folder='.', static_url_path='')

def today_str():
    d = datetime.utcnow()
    return f"{d.year}{str(d.month).zfill(2)}{str(d.day).zfill(2)}"

def implied(ml):
    try:
        ml = float(ml)
    except:
        return None
    if ml < 0:
        return (-ml) / ((-ml) + 100)
    return 100 / (ml + 100)

def no_vig(away_ml, home_ml):
    pA = implied(away_ml)
    pH = implied(home_ml)
    if pA is None or pH is None:
        return {"away": None, "home": None}
    d = pA + pH
    if d <= 0:
        return {"away": None, "home": None}
    return {"away": pA / d, "home": pH / d}

def json_response(obj, status=200):
    return Response(json.dumps(obj), status=status, mimetype='application/json', headers={'Access-Control-Allow-Origin': '*'})

@app.route('/', methods=['GET'])
def root():
    return send_file('index.html')

@app.route('/api/scoreboard', methods=['GET'])
def api_scoreboard():
    dates = request.args.get('dates') or today_str()
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={dates}"
    try:
        r = requests.get(url, timeout=12)
        r.raise_for_status()
        return Response(r.text, mimetype='application/json', headers={'Access-Control-Allow-Origin': '*'})
    except Exception as e:
        return json_response({"error": str(e)}, status=500)

@app.route('/api/ai-picks', methods=['POST'])
def api_ai_picks():
    if request.method != 'POST':
        return Response('Method Not Allowed', status=405)
    key = os.getenv('OPENAI_API_KEY', '')
    if not key:
        return json_response({"picks": [], "error": "OPENAI_API_KEY no está configurada"}, status=500)
    try:
        payload = request.get_json(force=True, silent=True) or {}
    except:
        payload = {}
    sys = 'Eres un analista MLB. Devuelve SOLO JSON. Para cada juego en input.games produce { "gameId": string, "topPicks": [ { "market": "ML"|"TOTAL"|"K"|"IP", "sideTeam"?: string, "side"?: "Over"|"Under", "line"?: number, "target"?: "away"|"home", "confidence": "strong"|"medium", "reason": string } ] }. Para ML usa "sideTeam" con abreviatura del equipo. Para TOTAL usa side y line. Para K e IP usa target=away|home y side, line si aplica. Máximo 3 picks por juego. Prioriza value según estas señales: abridores combinando 2025+2026, WHIP, K/BB, IP promedio y split relevante del día (home para el local, away para el visitante), ofensiva con R/G 2025+2026, AVG 2025 del equipo, hits por juego L10, proporción de bateadores con hit vs sin hit para medir bate caliente, momios y clima. Da más peso a la localía/split correcto del pitcher que al promedio general. Evita picks débiles si las señales chocan. Razones breves y concretas. No incluyas texto fuera del JSON.'
    try:
        r = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
            json={'model': 'gpt-4o-mini', 'messages': [{'role': 'system', 'content': sys}, {'role': 'user', 'content': json.dumps(payload)}], 'temperature': 0.2, 'response_format': {'type': 'json_object'}},
            timeout=30
        )
        if r.status_code != 200:
            return json_response({"picks": [], "error": r.text}, status=200)
        data = r.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '{"picks": []}')
        return Response(content, mimetype='application/json', headers={'Access-Control-Allow-Origin': '*'})
    except Exception as e:
        return json_response({"picks": [], "error": "Fallo IA"}, status=500)

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    key = os.getenv('OPENAI_API_KEY', '')
    if not key:
        return json_response({"picks": [], "error": "OPENAI_API_KEY no está configurada"}, status=500)
    try:
        body = request.get_json(force=True, silent=True) or {}
    except:
        body = {}
    date_key = str(body.get('date', '')).replace('-', '') or today_str()
    sb_url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={date_key}"
    try:
        sb = requests.get(sb_url, timeout=12)
        sb.raise_for_status()
        data = sb.json()
    except Exception as e:
        return json_response({"picks": [], "error": str(e)}, status=200)
    events = data.get('events', [])
    games = []
    for ev in events:
        comp = (ev.get('competitions') or [{}])[0]
        comps = comp.get('competitors') or []
        away = next((c for c in comps if c.get('homeAway') == 'away'), {})
        home = next((c for c in comps if c.get('homeAway') == 'home'), {})
        game_id = str(ev.get('id') or comp.get('id') or '')
        odds0 = (comp.get('odds') or [{}])[0]
        mlAway = odds0.get('moneyline', {}).get('away', {}).get('close', {}).get('odds')
        if mlAway is None: mlAway = odds0.get('moneyline', {}).get('away', {}).get('open', {}).get('odds')
        mlHome = odds0.get('moneyline', {}).get('home', {}).get('close', {}).get('odds')
        if mlHome is None: mlHome = odds0.get('moneyline', {}).get('home', {}).get('open', {}).get('odds')
        total = odds0.get('total', {}).get('over', {}).get('close', {}).get('line')
        if total is None: total = odds0.get('total', {}).get('over', {}).get('open', {}).get('line')
        nv = no_vig(mlAway, mlHome)
        weather = ev.get('weather', {})
        venue = comp.get('venue', {})
        games.append({
            "gameId": game_id,
            "away": {"abr": away.get('team', {}).get('abbreviation', ''), "id": away.get('team', {}).get('id', '')},
            "home": {"abr": home.get('team', {}).get('abbreviation', ''), "id": home.get('team', {}).get('id', '')},
            "odds": {"mlAway": mlAway if isinstance(mlAway, (int, float)) else None, "mlHome": mlHome if isinstance(mlHome, (int, float)) else None, "total": total if isinstance(total, (int, float)) else None, "novig": nv},
            "weather": {"tempF": weather.get('temperature'), "indoor": bool(weather.get('isIndoor'))},
            "venue": {"name": venue.get('fullName', '')}
        })
    sys = 'Eres un analista MLB. Devuelve SOLO JSON. Para cada juego en input.games produce { "gameId": string, "topPicks": [ { "market": "ML"|"TOTAL"|"K"|"IP", "sideTeam"?: string, "side"?: "Over"|"Under", "line"?: number, "target"?: "away"|"home", "confidence": "strong"|"medium", "reason": string } ] }. Para ML usa "sideTeam" con abreviatura del equipo. Para TOTAL usa side y line. Para K e IP usa target=away|home y side, line si aplica. Máximo 3 picks por juego. Prioriza value según estas señales: abridores combinando 2025+2026, WHIP, K/BB, IP promedio y split relevante del día (home para el local, away para el visitante), ofensiva con R/G 2025+2026, AVG 2025 del equipo, hits por juego L10, proporción de bateadores con hit vs sin hit para medir bate caliente, momios y clima. Da más peso a la localía/split correcto del pitcher que al promedio general. Evita picks débiles si las señales chocan. Razones breves y concretas. No incluyas texto fuera del JSON.'
    try:
        r = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {os.getenv("OPENAI_API_KEY","")}', 'Content-Type': 'application/json'},
            json={'model': 'gpt-4o-mini', 'messages': [{'role': 'system', 'content': sys}, {'role': 'user', 'content': json.dumps({'date': date_key, 'games': games})}], 'temperature': 0.2, 'response_format': {'type': 'json_object'}},
            timeout=30
        )
        if r.status_code != 200:
            return json_response({"picks": []}, status=200)
        data = r.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '{"picks": []}')
        return Response(content, mimetype='application/json', headers={'Access-Control-Allow-Origin': '*'})
    except:
        return json_response({"picks": []}, status=200)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
