#!/usr/bin/env python3
"""
Fetch book cover URLs from Open Library API and update notion-books.json.
Run: python3 scripts/fetch_covers.py
"""

import json
import urllib.request
import urllib.parse
import time
import sys
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'notion-books.json')
COVER_BASE = 'https://covers.openlibrary.org/b/id/{}-M.jpg'
SEARCH_URL = 'https://openlibrary.org/search.json?{}&limit=1&fields=cover_i'


def fetch_cover(title, authors):
    params = {'title': title}
    if authors:
        params['author'] = authors[0]
    url = SEARCH_URL.format(urllib.parse.urlencode(params))
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'life-dashboard/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        docs = data.get('docs', [])
        if docs and docs[0].get('cover_i'):
            return COVER_BASE.format(docs[0]['cover_i'])
    except Exception as e:
        print(f'  Error: {e}', file=sys.stderr)
    return None


def main():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    books = data['books']
    total = len(books)
    found = 0
    skipped = 0

    for i, book in enumerate(books):
        if book.get('coverUrl'):
            skipped += 1
            continue

        title = book.get('title', '')
        authors = book.get('autor', [])
        print(f'[{i+1}/{total}] {title}...', end=' ', flush=True)

        cover_url = fetch_cover(title, authors)
        if cover_url:
            book['coverUrl'] = cover_url
            found += 1
            print(f'✓')
        else:
            print(f'—')

        time.sleep(0.5)  # be polite to the API

    print(f'\nDone: {found} covers found, {skipped} skipped (already had URL), {total - found - skipped} not found.')

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'Updated {DATA_FILE}')


if __name__ == '__main__':
    main()
