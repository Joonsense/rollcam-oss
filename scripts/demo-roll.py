# /// script
# requires-python = ">=3.11"
# ///
"""Dev only: a believable demo year for store screenshots, from store/photos
(Unsplash, see store/photos/SOURCES.md). Each photo is developed with the film
its day's weather would pick, through the app's own shader (npm run develop),
and gets the reason line the app would write.

uv run scripts/demo-roll.py <outdir>   -> <outdir>/photos/*.jpg + <outdir>/seed.sql
Apply: pull rollcam.db from the device, sqlite3 rollcam.db < seed.sql, push back,
copy photos/* into files/photos (see docs/DEVICE-TEST.md).

uv run scripts/demo-roll.py <outdir> --zip ko|en|ja   -> <outdir>/rollcam-demo-<lang>.zip
A Settings > Restore zip with the day's lines in that language: works on a
release build (no file access needed), e.g. for store screenshots per language."""
import json, subprocess, sys, shutil, zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / 'store' / 'photos'
KST = timezone(timedelta(hours=9))
NAMES = {'daily-negative': 'Daily Negative', 'golden-roll': 'Golden Roll', 'night-tungsten': 'Night Tungsten', 'rainy-mono': 'Rainy Mono',
         'snow-pastel': 'Snow Pastel', 'haze-film': 'Haze Film', 'grey-portra': 'Grey Portra', 'summer-kodak': 'Summer Kodak',
         'winter-fuji': 'Winter Fuji', 'storm-push': 'Storm Push', 'motion-lofi': 'Motion Lo-Fi', 'party-flash': 'Party Flash'}

# day, photo, film, why (the app's wording), weather, hour
DAYS = [
    ('2026-01-12', '04-snowy-street', 'snow-pastel', '눈 내리는 오후', {'code': 73, 'tempC': -2}, 15),
    ('2026-01-20', '05-snowy-street', 'night-tungsten', '해가 진 밤', {'code': 71, 'tempC': -6}, 21),
    ('2026-02-03', '11-winter-blue-sky', 'winter-fuji', '차갑고 맑은 아침', {'code': 0, 'tempC': -4}, 9),
    ('2026-08-08', '09-summer-beach', 'summer-kodak', '뜨거운 한낮', {'code': 0, 'tempC': 31}, 12),
    ('2026-08-14', '10-summer-beach', 'summer-kodak', '뜨거운 오후', {'code': 1, 'tempC': 30}, 15),
    ('2026-10-01', '01-golden-hour-street', 'golden-roll', '해 지는 무렵', {'code': 1, 'tempC': 19}, 18),
    ('2026-10-02', '02-rainy-window', 'night-tungsten', '해가 진 밤', {'code': 61, 'tempC': 15}, 21),
    ('2026-10-03', '03-rainy-window', 'rainy-mono', '비 오는 오후', {'code': 63, 'tempC': 14}, 16),
    ('2026-10-05', '06-foggy-morning', 'haze-film', '안개 낀 아침', {'code': 45, 'tempC': 11}, 7),
    ('2026-10-06', '07-foggy-morning', 'haze-film', '안개 낀 아침', {'code': 45, 'tempC': 12}, 8),
    ('2026-10-07', '12-cafe-window', 'daily-negative', '평범한 오후', {'code': 1, 'tempC': 20}, 14),
    ('2026-10-08', '13-cafe-window', 'grey-portra', '흐린 오후', {'code': 3, 'tempC': 17, 'cloud': 85}, 15),
    ('2026-10-10', '14-storm-clouds', 'storm-push', '천둥 치는 오후', {'code': 95, 'tempC': 18}, 17),
    ('2026-10-11', '15-windy-grass', 'motion-lofi', '바람 센 오후', {'code': 2, 'tempC': 16, 'windMs': 11}, 15),
    ('2026-10-12', '16-birthday-cake-candles', 'party-flash', '생일', {'code': 0, 'tempC': 17}, 20),
    ('2026-10-13', '17-morning-coffee-table', 'daily-negative', '평범한 아침', {'code': 1, 'tempC': 13}, 9),
    ('2026-10-14', '18-cat-window', 'grey-portra', '흐린 아침', {'code': 3, 'tempC': 12, 'cloud': 90}, 10),
    ('2026-10-16', '19-cat-window', 'daily-negative', '평범한 한낮', {'code': 1, 'tempC': 18}, 12),
    ('2026-10-17', '20-flowers-sunlight', 'golden-roll', '해 지는 무렵', {'code': 0, 'tempC': 17}, 18),
    ('2026-10-18', '21-seoul-street', 'golden-roll', '해 지는 무렵', {'code': 1, 'tempC': 16}, 17),
    ('2026-10-19', '22-seoul-street', 'daily-negative', '평범한 오후', {'code': 1, 'tempC': 15}, 14),
    ('2026-10-20', '23-bicycle-street', 'rainy-mono', '비 오는 오후', {'code': 61, 'tempC': 13}, 16),
    ('2025-10-25', '21-seoul-street', 'golden-roll', '해 지는 무렵', {'code': 1, 'tempC': 15}, 17),
    ('2026-10-25', '15-windy-grass', 'motion-lofi', '바람 센 오후', {'code': 2, 'tempC': 15, 'windMs': 11}, 15),
]

# a few days' lines, per language (--zip)
MEMOS = {
    '2026-10-01': ('골목 끝까지 노을', 'Sunset all the way down the alley', '路地の奥まで夕焼け'),
    '2026-10-03': ('우산 두고 나온 날', 'Left my umbrella at home', '傘を忘れた日'),
    '2026-10-06': ('안개 속 첫 출근', 'First day at work, in the fog', '霧の中の初出勤'),
    '2026-10-12': ('서른 번째 생일', 'Thirty candles', '三十回目の誕生日'),
    '2026-10-14': ('고양이가 먼저 깼다', 'The cat woke up first', '猫が先に起きていた'),
    '2026-10-18': ('퇴근길 하늘이 이상하게 예뻤다', 'The sky on the way home', '帰り道の空がやけにきれいだった'),
    '2026-10-25': ('바람에 다 흔들리는 오후', 'Everything swaying in the wind', '風ですべてが揺れる午後'),
}

def main():
    out = Path(sys.argv[1]); dev = out / 'dev'; ph = out / 'photos'
    lang = sys.argv[sys.argv.index('--zip') + 1] if '--zip' in sys.argv else None
    for d in (dev, ph): d.mkdir(parents=True, exist_ok=True)
    sql = []
    rows = []
    for day, stem, film, why, wx, hour in DAYS:
        y, m, d = map(int, day.split('-'))
        ts = int(datetime(y, m, d, hour, 12, tzinfo=KST).timestamp() * 1000)
        subprocess.run(['node', '--experimental-strip-types', '--no-warnings', 'scripts/develop-node.ts', str(PHOTOS / f'{stem}.jpg'), str(dev), film, '--date', day, '--seed', str(ts % 997)],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        name = f'{day}-{ts}.jpg'
        shutil.copy(dev / f'{stem}.jpg', ph / name)
        reason = f"{why} — '{NAMES[film]}'".replace("'", "''")
        sql.append(f"INSERT OR REPLACE INTO shots VALUES ('{day}','{name}','{film}','{reason}','{json.dumps(wx)}',{ts});")
        memo = MEMOS.get(day, ('', '', ''))[{'ko': 0, 'en': 1, 'ja': 2}.get(lang, 0)]
        rows.append({'day': day, 'file': name, 'film': film, 'reason': f"{why} — '{NAMES[film]}'", 'weather': wx, 'takenAt': ts, 'memo': memo})
    (out / 'seed.sql').write_text('\n'.join(sql) + '\n')
    print(len(sql), 'demo days ->', out)
    if lang:
        # the same shape exportZip writes (lib/exportData.ts, lib/restore.ts)
        z = out / f'rollcam-demo-{lang}.zip'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as f:
            f.writestr('rollcam.json', json.dumps({'exportedAt': datetime.now(KST).isoformat(), 'shots': rows}, ensure_ascii=False, indent=2))
            for r in rows: f.write(ph / r['file'], f"photos/{r['file']}")
        print('restore zip ->', z)

main()
