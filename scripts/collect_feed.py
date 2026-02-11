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
import urllib.request
import urllib.error
from datetime import datetime, timedelta
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
            # Extract the author from the text (usually "AuthorName: ..." pattern)
            father = 'Padre de la Iglesia'
            author_match = re.match(r'^(.+?(?:Agustín|Crisóstomo|Orígenes|Ambrosio|Jerónimo|Gregorio|Basilio|Cirilo|Efrén|Tertuliano|Atanasio|Ireneo|Clemente|Augustine|Chrysostom|Origen|Ambrose|Jerome|Gregory|Basil|Cyril|Ephrem|Tertullian|Athanasius|Irenaeus|Clement)[\w\s]*?)[:.]', text[:200])
            if author_match:
                father = author_match.group(1).strip()
            else:
                # Try simpler pattern: first sentence as title
                first_line = text.split('\n')[0][:100] if text else ''
                if first_line:
                    father = first_line

            comments.append({
                'reading_ref': reference,
                'father': father[:100],
                'text': text[:800],  # Cap for dashboard display
                'verse_ref': entry_ref,
            })

    # Return max 3 most relevant comments
    return comments[:3]


# ── Reddit ──

def fetch_subreddit(subreddit, limit=10):
    """Fetch top posts from a subreddit (last week)."""
    try:
        url = f'https://www.reddit.com/r/{subreddit}/top.json?t=week&limit={limit}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'DashboardCollector/1.0 (personal feed aggregator)'
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())

        posts = []
        for child in data.get('data', {}).get('children', []):
            d = child.get('data', {})
            posts.append({
                'title': d.get('title', ''),
                'url': f"https://reddit.com{d.get('permalink', '')}",
                'source': f"r/{subreddit}",
                'score': d.get('score', 0),
                'num_comments': d.get('num_comments', 0),
                'created_utc': d.get('created_utc', 0),
                'selftext': (d.get('selftext', '') or '')[:200],
            })
        return posts
    except Exception as e:
        print(f"  Warning: Could not fetch r/{subreddit}: {e}")
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
    for sub in subreddits:
        posts = fetch_subreddit(sub, limit=5)
        all_posts.extend(posts)
        if posts:
            print(f"  r/{sub}: {len(posts)} posts")

    sections = categorize_posts(all_posts, config)

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
