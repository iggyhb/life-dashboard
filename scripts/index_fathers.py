#!/usr/bin/env python3
"""
Index the "La Biblia Comentada por los Padres de la Iglesia" PDF.

Reads the full-text extraction and produces a JSON index mapping
Bible references (e.g. "Genesis 2:7", "Mark 7:14-23") to the
patristic commentary text found under each heading.

Output: data/fathers_index.json
"""

import re
import json
import sys
from pathlib import Path
from collections import defaultdict

# ── Bible book names (Spanish) mapped to canonical English keys ──
# We use English keys so the lectionary API references match
BOOK_MAP = {
    # Old Testament
    'Génesis': 'Genesis', 'Genesis': 'Genesis',
    'Éxodo': 'Exodus', 'Exodo': 'Exodus', 'Exodus': 'Exodus',
    'Levítico': 'Leviticus', 'Levitico': 'Leviticus',
    'Números': 'Numbers', 'Numeros': 'Numbers',
    'Deuteronomio': 'Deuteronomy',
    'Josué': 'Joshua', 'Josue': 'Joshua',
    'Jueces': 'Judges',
    'Rut': 'Ruth', 'Ruth': 'Ruth',
    '1 Samuel': '1 Samuel', '2 Samuel': '2 Samuel',
    '1 Reyes': '1 Kings', '2 Reyes': '2 Kings',
    '1 Crónicas': '1 Chronicles', '2 Crónicas': '2 Chronicles',
    'Esdras': 'Ezra', 'Nehemías': 'Nehemiah', 'Nehemias': 'Nehemiah',
    'Tobías': 'Tobit', 'Tobias': 'Tobit',
    'Judit': 'Judith', 'Judith': 'Judith',
    'Ester': 'Esther', 'Esther': 'Esther',
    'Job': 'Job',
    'Salmos': 'Psalms', 'Salmo': 'Psalms', 'Psalm': 'Psalms', 'Psalms': 'Psalms',
    'Proverbios': 'Proverbs',
    'Eclesiastés': 'Ecclesiastes', 'Eclesiastes': 'Ecclesiastes',
    'Cantar de los Cantares': 'Song of Solomon', 'Cantar': 'Song of Solomon',
    'Sabiduría': 'Wisdom', 'Sabiduria': 'Wisdom', 'Wisdom': 'Wisdom',
    'Eclesiástico': 'Sirach', 'Eclesiastico': 'Sirach', 'Sirach': 'Sirach',
    'Isaías': 'Isaiah', 'Isaias': 'Isaiah', 'Isaiah': 'Isaiah',
    'Jeremías': 'Jeremiah', 'Jeremias': 'Jeremiah',
    'Lamentaciones': 'Lamentations',
    'Baruc': 'Baruch', 'Baruch': 'Baruch',
    'Ezequiel': 'Ezekiel',
    'Daniel': 'Daniel',
    'Oseas': 'Hosea',
    'Joel': 'Joel',
    'Amós': 'Amos', 'Amos': 'Amos',
    'Abdías': 'Obadiah', 'Abdias': 'Obadiah',
    'Jonás': 'Jonah', 'Jonas': 'Jonah',
    'Miqueas': 'Micah',
    'Nahún': 'Nahum', 'Nahum': 'Nahum',
    'Habacuc': 'Habakkuk',
    'Sofonías': 'Zephaniah', 'Sofonias': 'Zephaniah',
    'Ageo': 'Haggai',
    'Zacarías': 'Zechariah', 'Zacarias': 'Zechariah',
    'Malaquías': 'Malachi', 'Malaquias': 'Malachi',
    # New Testament
    'Mateo': 'Matthew', 'Matthew': 'Matthew',
    'Marcos': 'Mark', 'Mark': 'Mark',
    'Lucas': 'Luke', 'Luke': 'Luke',
    'Juan': 'John', 'John': 'John',
    'Hechos': 'Acts', 'Acts': 'Acts',
    'Romanos': 'Romans', 'Romans': 'Romans',
    '1 Corintios': '1 Corinthians', '2 Corintios': '2 Corinthians',
    'Gálatas': 'Galatians', 'Galatas': 'Galatians',
    'Efesios': 'Ephesians',
    'Filipenses': 'Philippians',
    'Colosenses': 'Colossians',
    '1 Tesalonicenses': '1 Thessalonians', '2 Tesalonicenses': '2 Thessalonians',
    '1 Timoteo': '1 Timothy', '2 Timoteo': '2 Timothy',
    'Tito': 'Titus',
    'Filemón': 'Philemon', 'Filemon': 'Philemon',
    'Hebreos': 'Hebrews', 'Hebrews': 'Hebrews',
    'Santiago': 'James', 'James': 'James',
    '1 Pedro': '1 Peter', '2 Pedro': '2 Peter',
    '1 Juan': '1 John', '2 Juan': '2 John', '3 Juan': '3 John',
    'Judas': 'Jude',
    'Apocalipsis': 'Revelation', 'Revelation': 'Revelation',
}

# Build sorted list of book names for regex (longest first to avoid partial matches)
ALL_BOOK_NAMES = sorted(BOOK_MAP.keys(), key=len, reverse=True)
BOOK_PATTERN = '|'.join(re.escape(b) for b in ALL_BOOK_NAMES)

# Pattern to match verse headings like "Génesis 1:1" or "Génesis 1:1-3" or "1 Reyes 10:1-10"
# Must be at the start of a line and be the entire line (or nearly)
HEADING_RE = re.compile(
    rf'^({BOOK_PATTERN})\s+(\d+)[:\.](\d+(?:\s*[-–]\s*\d+)?)\s*$'
)

# Also match range headings like "Génesis 2:8-9"
HEADING_RANGE_RE = re.compile(
    rf'^({BOOK_PATTERN})\s+(\d+)[:\.](\d+)\s*[-–]\s*(\d+)\s*$'
)

# Pattern for chapter-level headings like "Génesis 2:4-7" (range spanning verses)
HEADING_CHAPTER_RANGE_RE = re.compile(
    rf'^({BOOK_PATTERN})\s+(\d+)[:\.](\d+)\s*[-–]\s*(\d+)\s*$'
)


def normalize_reference(book_es, chapter, verse_str):
    """Convert Spanish book name + chapter:verse to canonical English reference."""
    book_en = BOOK_MAP.get(book_es, book_es)
    # Clean up verse string
    verse_clean = re.sub(r'\s+', '', verse_str)
    return f"{book_en} {chapter}:{verse_clean}"


def parse_verse_range(chapter, verse_str):
    """Parse a verse string like '14-23' into a list of individual verse refs."""
    verse_str = verse_str.strip()
    refs = []

    match = re.match(r'(\d+)\s*[-–]\s*(\d+)', verse_str)
    if match:
        start, end = int(match.group(1)), int(match.group(2))
        for v in range(start, end + 1):
            refs.append(f"{chapter}:{v}")
        # Also add the range itself
        refs.append(f"{chapter}:{start}-{end}")
    else:
        refs.append(f"{chapter}:{verse_str}")

    return refs


def index_text(text_path):
    """Parse the full text and build the index."""

    print(f"Reading {text_path}...")
    with open(text_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f"Total lines: {len(lines)}")

    # Index: { "Genesis 1:1": { "text": "...", "overview": "...", "line": N } }
    index = {}
    current_ref = None
    current_text_lines = []
    current_overview = None
    heading_count = 0

    for i, line in enumerate(lines):
        line_stripped = line.strip()

        # Skip empty lines at the start of a section
        if not line_stripped:
            if current_ref:
                current_text_lines.append('')
            continue

        # Check if this line is a verse heading
        m = HEADING_RE.match(line_stripped)
        if m:
            # Save previous section
            if current_ref and current_text_lines:
                text = '\n'.join(current_text_lines).strip()
                if text and len(text) > 50:  # Skip very short/empty entries
                    index[current_ref] = {
                        'text': text,
                        'line': i - len(current_text_lines),
                    }

            book_es = m.group(1)
            chapter = m.group(2)
            verse_str = m.group(3)

            current_ref = normalize_reference(book_es, chapter, verse_str)
            current_text_lines = []
            heading_count += 1

            if heading_count % 500 == 0:
                print(f"  Processed {heading_count} headings... (currently at {current_ref})")
        else:
            if current_ref:
                current_text_lines.append(line_stripped)

    # Save last section
    if current_ref and current_text_lines:
        text = '\n'.join(current_text_lines).strip()
        if text and len(text) > 50:
            index[current_ref] = {
                'text': text,
                'line': len(lines) - len(current_text_lines),
            }

    print(f"\nTotal verse headings found: {heading_count}")
    print(f"Index entries with content: {len(index)}")

    return index


def build_lookup_index(index):
    """
    Build a lookup-friendly index where we can find content by:
    - Exact reference: "Mark 7:14-23"
    - Individual verse: "Mark 7:14", "Mark 7:15", etc.
    - Chapter: "Mark 7"

    Returns a more compact format for the JSON output.
    """
    # Group by book and chapter for efficient lookup
    by_book_chapter = defaultdict(list)

    for ref, data in index.items():
        # Parse reference
        m = re.match(r'(.+?)\s+(\d+):(.+)', ref)
        if m:
            book = m.group(1)
            chapter = m.group(2)
            verses = m.group(3)

            by_book_chapter[f"{book} {chapter}"].append({
                'ref': ref,
                'verses': verses,
                'text': data['text'][:2000],  # Cap at 2000 chars to keep index manageable
            })

    return dict(by_book_chapter)


def main():
    text_path = '/tmp/padres_iglesia_full.txt'

    # Output directory
    out_dir = Path(__file__).parent.parent / 'data'
    out_dir.mkdir(exist_ok=True)

    # Step 1: Parse and index
    index = index_text(text_path)

    # Step 2: Build lookup-friendly structure
    lookup = build_lookup_index(index)

    # Step 3: Save full index
    out_path = out_dir / 'fathers_index.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(lookup, f, ensure_ascii=False, indent=1)

    file_size = out_path.stat().st_size / (1024 * 1024)
    print(f"\nIndex saved to {out_path}")
    print(f"File size: {file_size:.1f} MB")
    print(f"Books/chapters indexed: {len(lookup)}")

    # Step 4: Show some stats
    print("\n── Sample entries ──")
    sample_keys = list(lookup.keys())[:5]
    for key in sample_keys:
        entries = lookup[key]
        print(f"  {key}: {len(entries)} verse(s)")
        for entry in entries[:2]:
            print(f"    - {entry['ref']}: {entry['text'][:100]}...")

    # Show NT coverage (most relevant for daily Mass readings)
    nt_books = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
                '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
                'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
                '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
                'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
                'Jude', 'Revelation']

    print("\n── New Testament coverage ──")
    for book in nt_books:
        chapters = [k for k in lookup.keys() if k.startswith(book + ' ')]
        if chapters:
            total_verses = sum(len(lookup[c]) for c in chapters)
            print(f"  {book}: {len(chapters)} chapters, {total_verses} verse entries")


if __name__ == '__main__':
    main()
