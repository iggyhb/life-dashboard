#!/usr/bin/env python3
"""
Weekly Feed Collector
Fetches liturgical readings, patristic comments, and Reddit posts.
Outputs data/weekly-feed.json for the dashboard.

Usage:
  python3 scripts/collect_feed.py              # Today's readings + Reddit
  python3 scripts/collect_feed.py 2026-02-11   # Specific date

No AI tokens needed for this script. AI ranking is optional (separate step).
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / 'data'
CONFIG_PATH = DATA_DIR / 'config.json'
FATHERS_INDEX_PATH = DATA_DIR / 'fathers_index.json'
OUTPUT_PATH = DATA_DIR / 'weekly-feed.json'

# ── Config ──

def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {
        'topics': [],
        'subreddits': ['Catholicism', 'ChatGPT', 'OpenAI'],
        'liturgy': {'enabled': True, 'include_fathers': True}
    }


# ── Liturgical Readings ──

def fetch_readings(date_str):
    """Fetch reading references from cpbjr Catholic Readings API."""
    try:
        year = date_str[:4]
        month_day = date_str[5:]  # MM-DD
        url = f'https://cpbjr.github.io/catholic-readings-api/readings/{year}/{month_day}.json'
        req = urllib.request.Request(url, headers={'User-Agent': 'DashboardCollector/1.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        return data
    except Exception as e:
        print(f"  Warning: Could not fetch readings for {date_str}: {e}")
        return None


def build_readings_list(api_data):
    """Convert API response to our reading format."""
    if not api_data or 'readings' not in api_data:
        return []

    readings = []
    r = api_data['readings']

    if r.get('firstReading'):
        readings.append({
            'type': 'first_reading',
            'reference': r['firstReading'],
            'summary': ''
        })
    if r.get('psalm'):
        readings.append({
            'type': 'psalm',
            'reference': r['psalm'],
            'summary': ''
        })
    if r.get('secondReading'):
        readings.append({
            'type': 'second_reading',
            'reference': r['secondReading'],
            'summary': ''
        })
    if r.get('gospel'):
        readings.append({
            'type': 'gospel',
            'reference': r['gospel'],
            'summary': ''
        })

    return readings


# ── Dominicos.org Spanish Readings Scraper ──

class DominicosParser(HTMLParser):
    """Parser to extract reading texts from dominicos.org."""
    def __init__(self):
        super().__init__()
        self.sections = {}
        self.current_section = None
        self.in_heading = False
        self.in_content = False
        self.current_text = []
        self._heading_buf = []
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.in_script = True
            return
        if self.in_script:
            return
        if tag in ('h2', 'h3', 'h4'):
            self.in_heading = True
            self._heading_buf = []
        if tag == 'br' and self.in_content:
            self.current_text.append('\n')
        if tag == 'p' and self.in_content:
            if self.current_text and self.current_text[-1] != '\n':
                self.current_text.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.in_script = False
            return
        if self.in_script:
            return
        if tag in ('h2', 'h3', 'h4') and self.in_heading:
            self.in_heading = False
            heading = ''.join(self._heading_buf).strip().lower()
            # Save previous section
            if self.current_section and self.current_text:
                self.sections[self.current_section] = ''.join(self.current_text).strip()
            # Detect reading sections
            if 'primera lectura' in heading:
                self.current_section = 'primera_lectura'
                self.current_text = []
                self.in_content = True
            elif 'segunda lectura' in heading:
                self.current_section = 'segunda_lectura'
                self.current_text = []
                self.in_content = True
            elif 'salmo' in heading:
                self.current_section = 'salmo'
                self.current_text = []
                self.in_content = True
            elif ('evangelio' in heading
                  and 'suscripci' not in heading and 'vídeo' not in heading
                  and 'video' not in heading and 'audio' not in heading
                  and 'reflexi' not in heading
                  and 'evangelio' not in self.sections):
                # Only capture evangelio once (skip "Reflexión del Evangelio", etc.)
                self.current_section = 'evangelio'
                self.current_text = []
                self.in_content = True
            elif self.current_section and (
                'comentario' in heading or 'reflexi' in heading or 'oración' in heading
                or 'suscripci' in heading or 'vídeo' in heading or 'video' in heading
                or 'audio' in heading
            ):
                # Stop: we've reached non-reading content
                if self.current_text:
                    self.sections[self.current_section] = ''.join(self.current_text).strip()
                self.current_section = None
                self.in_content = False

    def handle_data(self, data):
        if self.in_script:
            return
        if self.in_heading:
            self._heading_buf.append(data)
        elif self.in_content and self.current_section:
            self.current_text.append(data)

    def get_results(self):
        if self.current_section and self.current_text:
            self.sections[self.current_section] = ''.join(self.current_text).strip()
        return self.sections


def _clean_reading_text(text):
    """Clean up scraped reading text, removing promotional blocks."""
    # Remove WhatsApp/email subscription blocks that dominicos.org injects
    # These typically appear before the actual reading text
    promo_patterns = [
        r'Recibirá un único mensaje.*?(?:Políticas de Privacidad[^.]*\.)',
        r'Suscribirme por (?:Whatsapp|email).*?(?:campanita|email)\.',
        r'He leído y acepto.*?(?:LOPD|protección de datos)[^.]*\.',
        r'De conformidad con.*?(?:LOPD|protección)[^.]*\.',
        r'La Oficina de Comunicación.*?(?:recabados|garantiza)[^.]*\.',
    ]
    for pattern in promo_patterns:
        text = re.sub(pattern, '', text, flags=re.DOTALL | re.IGNORECASE)

    # Try to find the actual reading start markers
    reading_markers = [
        'Lectura del santo', 'Lectura del libro', 'Lectura de la carta',
        'Lectura de la profecía', 'Lectura del profeta',
        'Del libro', 'Del salmo',
        'En aquel tiempo', 'En aquellos días',
        'Dichosos los que', 'Encomienda tu camino',
        'Cuando el rey', 'Así dice el Señor',
    ]
    for marker in reading_markers:
        idx = text.find(marker)
        if idx > 0:
            text = text[idx:]
            break

    # Collapse excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^\s*\n', '', text)
    text = text.strip()
    return text


def fetch_reading_texts_es(date_str):
    """Fetch Spanish reading texts from dominicos.org."""
    try:
        # URL format: DD-M-YYYY (no leading zero on month)
        d = datetime.strptime(date_str, '%Y-%m-%d')
        url_date = f'{d.day}-{d.month}-{d.year}'
        url = f'https://www.dominicos.org/predicacion/evangelio-del-dia/{url_date}/'
        print(f"  Fetching Spanish readings from dominicos.org...")

        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; LifeDashboard/1.0)'
        })
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode('utf-8', errors='replace')

        parser = DominicosParser()
        parser.feed(html)
        sections = parser.get_results()

        cleaned = {}
        for key, text in sections.items():
            text = _clean_reading_text(text)
            if text and len(text) > 20:
                cleaned[key] = text
        return cleaned
    except Exception as e:
        print(f"  Warning: Could not fetch Spanish readings: {e}")
        return {}


def attach_reading_texts(readings, es_texts):
    """Match scraped Spanish sections to our reading objects."""
    type_map = {
        'first_reading': 'primera_lectura',
        'psalm': 'salmo',
        'second_reading': 'segunda_lectura',
        'gospel': 'evangelio',
    }
    for reading in readings:
        key = type_map.get(reading['type'], '')
        if key and key in es_texts:
            reading['text'] = es_texts[key]


# ── Patristic Comments Lookup ──

def load_fathers_index():
    """Load the pre-built patristic index."""
    if not FATHERS_INDEX_PATH.exists():
        print("  Warning: fathers_index.json not found. Run index_fathers.py first.")
        return {}
    print(f"  Loading fathers index ({FATHERS_INDEX_PATH.stat().st_size / 1024 / 1024:.1f} MB)...")
    with open(FATHERS_INDEX_PATH) as f:
        return json.load(f)


def parse_reference(ref_str):
    """
    Parse a reference like '1 Kings 10:1-10' or 'Mark 7:14-23'
    Returns (book, chapter, start_verse, end_verse) or None.
    """
    # Handle references like "Psalm 37:5-6, 30-31, 39-40" - just take first range
    ref_str = ref_str.split(',')[0].strip()

    m = re.match(r'(\d?\s*\w[\w\s]*?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?', ref_str)
    if m:
        book = m.group(1).strip()
        chapter = m.group(2)
        start = int(m.group(3))
        end = int(m.group(4)) if m.group(4) else start
        return book, chapter, start, end
    return None


# Known Church Fathers - Spanish and English names mapped to Spanish display names
FATHERS_MAP = {
    'orígenes': 'Orígenes', 'origenes': 'Orígenes', 'origen': 'Orígenes',
    'crisóstomo': 'San Juan Crisóstomo', 'crisostomo': 'San Juan Crisóstomo', 'chrysostom': 'San Juan Crisóstomo',
    'beda': 'San Beda', 'bede': 'San Beda',
    'efrén': 'San Efrén', 'efren': 'San Efrén', 'ephrem': 'San Efrén',
    'agustín': 'San Agustín', 'agustin': 'San Agustín', 'augustine': 'San Agustín',
    'ambrosio': 'San Ambrosio', 'ambrose': 'San Ambrosio',
    'jerónimo': 'San Jerónimo', 'jeronimo': 'San Jerónimo', 'jerome': 'San Jerónimo',
    'gregorio': 'San Gregorio', 'gregory': 'San Gregorio',
    'basilio': 'San Basilio', 'basil': 'San Basilio',
    'cirilo': 'San Cirilo', 'cyril': 'San Cirilo',
    'tertuliano': 'Tertuliano', 'tertullian': 'Tertuliano',
    'atanasio': 'San Atanasio', 'athanasius': 'San Atanasio',
    'ireneo': 'San Ireneo', 'irenaeus': 'San Ireneo',
    'clemente': 'San Clemente', 'clement': 'San Clemente',
    'juan de damasco': 'San Juan Damasceno', 'john of damascus': 'San Juan Damasceno',
    'hilario': 'San Hilario', 'hilary': 'San Hilario',
    'león': 'San León Magno', 'leo': 'San León Magno',
    'cipriano': 'San Cipriano', 'cyprian': 'San Cipriano',
}


def _extract_father_name(text):
    """Extract a Church Father name from patristic comment text."""
    text_lower = text.lower()
    # Search for known father names in the first 400 chars
    search_zone = text_lower[:400]
    for key, display in FATHERS_MAP.items():
        if key in search_zone:
            return display
    return ''


def _clean_patristic_text(text):
    """Clean patristic text: remove English bibliographic references, etc."""
    # Remove bibliographic references in brackets like [NPNF 2 13: 295.], [FC 94: 158.]
    text = re.sub(r'\[(?:NPNF|ANF|FC|CS|TLG|CETEDOC|CCL|PG|PL|SC|GCS|CSEL|CTP)\s*[\d:.,\s*\-]+\]', '', text)
    # Remove other English bibliographic refs like [Jerome Nom. Hebr. (CCL 72.144.3).]
    text = re.sub(r'\[\w+\s+\w+\s*\.\s*\w+\s*\.\s*\([^)]+\)\s*\.?\]', '', text)
    # Remove inline verse references like [ Joh_6: 35 .], [ Mar_7: 15 .]
    text = re.sub(r'\[\s*(?:Cf\.\s*)?[A-Z][a-z]{2}_\d+:\s*\d+[^]]*\]', '', text)
    # Remove [Ver ...] and [Esta es ...] editorial notes
    text = re.sub(r'\[(?:Ver|See|Esta es|Cf\.)[^]]{0,150}\]', '', text)
    # Replace common English words left from imperfect translation
    replacements = {
        'Broken': 'roto',
        'broken': 'roto',
    }
    for eng, esp in replacements.items():
        text = text.replace(eng, esp)
    # Clean up spacing artifacts from removals
    text = re.sub(r'\s{2,}', ' ', text)
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    return text.strip()


def lookup_fathers(fathers_index, reference):
    """
    Look up patristic comments for a Bible reference.
    Returns a list of comment dicts.
    """
    parsed = parse_reference(reference)
    if not parsed:
        return []

    book, chapter, start_verse, end_verse = parsed
    chapter_key = f"{book} {chapter}"

    entries = fathers_index.get(chapter_key, [])
    if not entries:
        return []

    comments = []
    for entry in entries:
        # Check if this entry overlaps with our verse range
        entry_ref = entry.get('ref', '')
        entry_parsed = parse_reference(entry_ref)
        if not entry_parsed:
            continue

        _, _, e_start, e_end = entry_parsed

        # Check overlap
        if e_start <= end_verse and e_end >= start_verse:
            text = entry.get('text', '')

            # Clean patristic text
            text = _clean_patristic_text(text)

            # Extract title (first line) and author name
            title = ''
            father = 'Padre de la Iglesia'
            lines = text.split('\n')
            if lines:
                title = lines[0].strip()

            # Find the actual Church Father name in the text
            father = _extract_father_name(text) or title

            # Remove the title from the body text if it's duplicated
            body = '\n'.join(lines[1:]).strip() if len(lines) > 1 else text

            comments.append({
                'reading_ref': reference,
                'title': title[:120],
                'father': father[:100],
                'text': body[:2000],
                'verse_ref': entry_ref,
            })

    # Return max 3 most relevant comments
    return comments[:3]


# ── Reddit ──

def fetch_subreddit(subreddit, limit=10, retries=2):
    """Fetch top posts from a subreddit (last week) with retry logic."""
    url = f'https://www.reddit.com/r/{subreddit}/top.json?t=week&limit={limit}&raw_json=1'
    headers = {
        'User-Agent': 'linux:life-dashboard:v1.0 (personal feed aggregator by /u/nachohb)',
        'Accept': 'application/json',
    }

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status == 429:
                    wait = 5 * (attempt + 1)
                    print(f"  Rate limited on r/{subreddit}, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                data = json.loads(resp.read().decode())

            posts = []
            for child in data.get('data', {}).get('children', []):
                d = child.get('data', {})
                # Get best thumbnail: prefer preview images, fall back to thumbnail
                thumb = ''
                try:
                    previews = d.get('preview', {}).get('images', [])
                    if previews:
                        # Get a medium resolution preview (~320px wide)
                        resolutions = previews[0].get('resolutions', [])
                        for res in resolutions:
                            if res.get('width', 0) >= 320:
                                thumb = res.get('url', '')
                                break
                        if not thumb and resolutions:
                            thumb = resolutions[-1].get('url', '')
                        if not thumb:
                            thumb = previews[0].get('source', {}).get('url', '')
                except Exception:
                    pass
                if not thumb:
                    t = d.get('thumbnail', '')
                    if t and t.startswith('http'):
                        thumb = t

                posts.append({
                    'title': d.get('title', ''),
                    'url': f"https://reddit.com{d.get('permalink', '')}",
                    'source': f"r/{subreddit}",
                    'score': d.get('score', 0),
                    'num_comments': d.get('num_comments', 0),
                    'created_utc': d.get('created_utc', 0),
                    'selftext': (d.get('selftext', '') or '')[:200],
                    'thumbnail': thumb,
                })
            return posts
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = 5 * (attempt + 1)
                print(f"  Rate limited on r/{subreddit} (429), waiting {wait}s...")
                time.sleep(wait)
                continue
            print(f"  Warning: HTTP {e.code} fetching r/{subreddit}: {e}")
            return []
        except Exception as e:
            if attempt < retries:
                time.sleep(2)
                continue
            print(f"  Warning: Could not fetch r/{subreddit}: {e}")
            return []
    return []


def categorize_posts(all_posts, config):
    """Group posts into sections based on subreddit and topic."""
    sections = {}

    # Define section mappings
    catholic_subs = {'Catholicism', 'Catholic', 'TraditionalCatholics'}
    ai_subs = {'ChatGPT', 'OpenAI', 'Artificial', 'ArtificialInteligence',
               'ChatGPTPro', 'AGI', 'AIPromptProgramming', 'MachineLearning',
               'LocalLLaMA', 'ClaudeAI'}

    for post in all_posts:
        sub = post['source'].replace('r/', '')

        if sub in catholic_subs:
            section_id = 'catholic'
            section_title = 'Iglesia Catolica'
        elif sub in ai_subs:
            section_id = 'ai'
            section_title = 'Inteligencia Artificial'
        else:
            section_id = 'other'
            section_title = 'Otros temas'

        if section_id not in sections:
            sections[section_id] = {
                'id': section_id,
                'title': section_title,
                'items': []
            }

        sections[section_id]['items'].append({
            'title': post['title'],
            'url': post['url'],
            'source': post['source'],
            'reddit_score': post['score'],
            'reddit_comments': post['num_comments'],
            'score': 0,  # Will be normalized later
            'summary': post['selftext'][:150] if post['selftext'] else '',
            'why_it_matters': '',
            'thumbnail': post.get('thumbnail', ''),
        })

    # Sort items in each section by combined Reddit score + comments
    for section in sections.values():
        section['items'].sort(
            key=lambda x: x.get('reddit_score', 0) + x.get('reddit_comments', 0) * 2,
            reverse=True
        )
        max_items = config.get('max_items_per_section', 10)
        section['items'] = section['items'][:max_items]

    # Normalize scores to 0-100 within each section
    for section in sections.values():
        if not section['items']:
            continue
        # Use combined reddit_score + comments*2 as the raw signal
        raw_scores = [
            item.get('reddit_score', 0) + item.get('reddit_comments', 0) * 2
            for item in section['items']
        ]
        max_raw = max(raw_scores) if raw_scores else 1
        max_raw = max(max_raw, 1)  # Avoid division by zero
        for item, raw in zip(section['items'], raw_scores):
            item['score'] = max(1, int((raw / max_raw) * 100))

    return list(sections.values())


# ── Main ──

def main():
    # Parse date argument
    if len(sys.argv) > 1:
        date_str = sys.argv[1]
    else:
        date_str = datetime.now().strftime('%Y-%m-%d')

    print(f"=== Feed Collector for {date_str} ===\n")

    config = load_config()

    # 1. Liturgical readings
    print("[1/3] Fetching liturgical readings...")
    liturgy_data = None
    if config.get('liturgy', {}).get('enabled', True):
        api_data = fetch_readings(date_str)
        readings = build_readings_list(api_data)

        liturgy_data = {
            'date': date_str,
            'season': api_data.get('season', '') if api_data else '',
            'readings': readings,
            'patristic_comments': [],
            'meditation': '',
            'prayer': '',
        }

        print(f"  Found {len(readings)} readings")

        # Fetch reading texts in Spanish from dominicos.org
        if readings:
            es_texts = fetch_reading_texts_es(date_str)
            if es_texts:
                attach_reading_texts(readings, es_texts)
                for r in readings:
                    has_text = '✓' if r.get('text') else '✗'
                    print(f"    {r['reference']}: texto {has_text}")
            else:
                print("    No se pudieron obtener los textos en español")

        # 2. Patristic comments
        if config.get('liturgy', {}).get('include_fathers', True) and readings:
            print("[2/3] Looking up Fathers of the Church...")
            fathers_index = load_fathers_index()
            if fathers_index:
                all_comments = []
                for reading in readings:
                    comments = lookup_fathers(fathers_index, reading['reference'])
                    all_comments.extend(comments)
                    if comments:
                        print(f"  {reading['reference']}: {len(comments)} patristic comment(s)")
                    else:
                        print(f"  {reading['reference']}: no match in index")
                liturgy_data['patristic_comments'] = all_comments
                print(f"  Total patristic comments: {len(all_comments)}")
        else:
            print("[2/3] Skipping Fathers lookup (disabled or no readings)")
    else:
        print("[1/3] Liturgy disabled in config")
        print("[2/3] Skipping Fathers")

    # 3. Reddit
    print("[3/3] Fetching Reddit posts...")
    subreddits = config.get('subreddits', [])
    all_posts = []
    for i, sub in enumerate(subreddits):
        if i > 0:
            time.sleep(2)  # Rate limit: 2s between subreddits
        posts = fetch_subreddit(sub, limit=5)
        all_posts.extend(posts)
        if posts:
            print(f"  r/{sub}: {len(posts)} posts")
        else:
            print(f"  r/{sub}: 0 posts (blocked or empty)")

    sections = categorize_posts(all_posts, config)

    # If Reddit returned nothing, try to keep previous Reddit data
    if not sections and OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH) as f:
                prev = json.load(f)
            prev_sections = prev.get('sections', [])
            if prev_sections:
                print("  Reddit returned no data. Keeping previous Reddit posts.")
                sections = prev_sections
        except Exception:
            pass

    # Build output
    output = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'week': datetime.now().strftime('%Y-W%W'),
        'liturgy': liturgy_data,
        'sections': sections,
    }

    # Write output
    DATA_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    output_size = OUTPUT_PATH.stat().st_size / 1024
    print(f"\n=== Done! ===")
    print(f"Output: {OUTPUT_PATH} ({output_size:.1f} KB)")
    print(f"Readings: {len(liturgy_data['readings']) if liturgy_data else 0}")
    print(f"Patristic comments: {len(liturgy_data['patristic_comments']) if liturgy_data else 0}")
    print(f"News sections: {len(sections)}")
    total_items = sum(len(s['items']) for s in sections)
    print(f"Total news items: {total_items}")


if __name__ == '__main__':
    main()
