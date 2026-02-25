import { Store } from '../store.js';
import { el, icon, clear } from '../utils/dom.js';

const ESTADOS = [
  'Leyendo', 'Por leer', 'Leído', 'Re-leer', 'Re-leyendo',
  'Wishlist', 'Next in line', 'Matar', 'Interrumpido', 'Wishlist Verano 2023'
];

const TIPOS = ['Espiritual', 'Cultura', 'Autoayuda', 'Otro'];

const ESTADO_COLORS = {
  'Leyendo':              'badge-blue',
  'Por leer':             'badge-orange',
  'Leído':                'badge-green',
  'Re-leer':              'badge-yellow',
  'Re-leyendo':           'badge-blue',
  'Wishlist':             'badge-purple',
  'Next in line':         'badge-orange',
  'Matar':                'badge-red',
  'Interrumpido':         'badge-red',
  'Wishlist Verano 2023': 'badge-purple'
};

const ESTADO_ORDER = {
  'Leyendo': 0, 'Re-leyendo': 0,
  'Por leer': 1, 'Next in line': 1,
  'Leído': 2, 'Re-leer': 2,
  'Wishlist': 3, 'Wishlist Verano 2023': 3,
  'Interrumpido': 4, 'Matar': 5
};

const RATING_OPTIONS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

// Filter tab groups
const FILTER_TABS = [
  { key: 'all',         label: 'All' },
  { key: 'Leyendo',     label: 'Leyendo' },
  { key: 'Por leer',    label: 'Por leer' },
  { key: 'Leído',       label: 'Leído' },
  { key: 'Wishlist',    label: 'Wishlist' },
  { key: 'Re-leer',     label: 'Re-leer' },
  { key: 'other',       label: 'Otros' }
];

const OTHER_ESTADOS = new Set(['Next in line', 'Matar', 'Interrumpido', 'Wishlist Verano 2023', 'Re-leyendo']);

function matchesFilter(book, key) {
  if (key === 'all') return true;
  if (key === 'other') return OTHER_ESTADOS.has(book.estado);
  return book.estado === key;
}

export default {
  id: 'books',
  label: 'Books',
  icon: 'book',
  color: 'var(--accent-yellow)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Libros'),
      el('div', { style: { display: 'flex', gap: '8px' } }, [
        el('button', {
          className: 'btn btn-secondary',
          onClick: () => this.importNotionBooks()
        }, 'Import Notion'),
        el('button', {
          className: 'btn btn-primary',
          onClick: () => this.showForm()
        }, [icon('plus'), 'Add'])
      ])
    ]);
    container.appendChild(header);

    // Stats bar
    const stats = el('div', { className: 'books-stats' });
    container.appendChild(stats);

    // Filters
    const filterRow = el('div', { className: 'tabs' });
    container.appendChild(filterRow);

    // Search
    const searchWrap = el('div', { className: 'search-wrapper' });
    const searchIcon = icon('search');
    searchIcon.classList.add('search-icon');
    const searchInput = el('input', {
      className: 'search-input',
      type: 'text',
      placeholder: 'Search books, authors, tags...'
    });
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    const grid = el('div', { className: 'book-grid' });
    container.appendChild(grid);

    let activeFilter = 'all';
    let searchTerm = '';

    const buildFilters = () => {
      clear(filterRow);
      const books = Store.getCategory('books');

      for (const tab of FILTER_TABS) {
        const count = tab.key === 'all'
          ? books.length
          : books.filter(b => matchesFilter(b, tab.key)).length;
        const btn = el('button', {
          className: `tab ${activeFilter === tab.key ? 'active' : ''}`,
          onClick: () => { activeFilter = tab.key; buildFilters(); renderGrid(); }
        }, `${tab.label} (${count})`);
        filterRow.appendChild(btn);
      }
    };

    const renderStats = () => {
      clear(stats);
      const books = Store.getCategory('books');
      const read    = books.filter(b => b.estado === 'Leído').length;
      const reading = books.filter(b => b.estado === 'Leyendo' || b.estado === 'Re-leyendo').length;
      const toRead  = books.filter(b => b.estado === 'Por leer' || b.estado === 'Next in line').length;
      const wish    = books.filter(b => b.estado === 'Wishlist' || b.estado === 'Wishlist Verano 2023').length;

      const statGrid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: '8px',
          marginBottom: '16px'
        }
      });

      const makeStat = (label, value, color) => {
        const card = el('div', { className: 'card', style: { textAlign: 'center', padding: '10px 8px' } });
        card.appendChild(el('div', { style: { fontSize: '1.3rem', fontWeight: '700', color } }, String(value)));
        card.appendChild(el('div', { style: { fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' } }, label));
        return card;
      };

      statGrid.appendChild(makeStat('Total',   books.length, 'var(--text-primary)'));
      statGrid.appendChild(makeStat('Leído',   read,         'var(--accent-green)'));
      statGrid.appendChild(makeStat('Leyendo', reading,      'var(--accent-blue)'));
      statGrid.appendChild(makeStat('Por leer',toRead,       'var(--accent-orange)'));
      statGrid.appendChild(makeStat('Wishlist',wish,         'var(--accent-purple)'));
      stats.appendChild(statGrid);
    };

    const renderGrid = () => {
      clear(grid);
      let books = Store.getCategory('books');

      if (activeFilter !== 'all') {
        books = books.filter(b => matchesFilter(b, activeFilter));
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        books = books.filter(b =>
          (b.title || '').toLowerCase().includes(s) ||
          (b.autor || []).some(a => a.toLowerCase().includes(s)) ||
          (b.tags || []).some(t => t.toLowerCase().includes(s)) ||
          (b.tipo || '').toLowerCase().includes(s)
        );
      }

      books.sort((a, b) => {
        const oa = ESTADO_ORDER[a.estado] ?? 9;
        const ob = ESTADO_ORDER[b.estado] ?? 9;
        if (oa !== ob) return oa - ob;
        const da = (a.fechaLeido?.start || a.anoLeido || a.createdAt || '');
        const db = (b.fechaLeido?.start || b.anoLeido || b.createdAt || '');
        return db.localeCompare(da);
      });

      if (books.length === 0) {
        grid.appendChild(el('div', { className: 'empty-state' }, [
          icon('notes'),
          el('h3', {}, searchTerm ? 'No matching books' : 'No books yet'),
          el('p', {}, searchTerm ? 'Try a different search' : 'Add books or use Import Notion')
        ]));
        return;
      }

      for (const book of books) {
        grid.appendChild(this.renderBookCard(book));
      }
    };

    searchInput.addEventListener('input', e => { searchTerm = e.target.value; renderGrid(); });

    buildFilters();
    renderStats();
    renderGrid();

    const unsub = Store.on('books', () => { buildFilters(); renderStats(); renderGrid(); });
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderBookCard(book) {
    const card = el('div', { className: 'book-card' });
    card.addEventListener('click', () => this.showDetail(book));

    // Cover image area
    const coverDiv = el('div', { className: 'book-cover' });
    if (book.coverUrl) {
      const img = el('img', { src: book.coverUrl, alt: '' });
      img.addEventListener('error', () => {
        img.style.display = 'none';
        placeholder.style.display = 'flex';
      });
      coverDiv.appendChild(img);
    }
    const placeholder = el('div', { className: 'book-cover-placeholder' }, '📖');
    if (book.coverUrl) placeholder.style.display = 'none';
    coverDiv.appendChild(placeholder);
    card.appendChild(coverDiv);

    // Info area
    const info = el('div', { className: 'book-info' });

    const titleEl = el('span', { className: 'book-title' }, book.title || 'Untitled');
    info.appendChild(titleEl);

    const badgeColor = ESTADO_COLORS[book.estado] || 'badge-blue';
    info.appendChild(el('span', { className: `badge ${badgeColor}`, style: { marginTop: '4px', display: 'inline-block' } }, book.estado || ''));

    const meta = el('div', { className: 'book-meta' });
    const metaParts = [];
    if (book.autor && book.autor.length) metaParts.push(book.autor.join(', '));
    if (book.tipo && book.tipo !== 'Otro') metaParts.push(book.tipo);
    meta.textContent = metaParts.join(' · ');
    info.appendChild(meta);

    if (book.calificacion) {
      info.appendChild(el('div', { style: { fontSize: '0.7rem', marginTop: '2px' } }, book.calificacion));
    }

    card.appendChild(info);
    return card;
  },

  showDetail(book) {
    const old = document.getElementById('book-detail-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'book-detail-modal' });
    const modal = el('div', { className: 'modal', style: { maxWidth: '480px' } });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, book.title || 'Untitled'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const addRow = (label, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return;
      const row = el('div', { style: { marginBottom: '8px' } });
      row.appendChild(el('span', { style: { color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '8px' } }, label + ':'));
      row.appendChild(el('span', { style: { fontSize: '0.85rem' } }, Array.isArray(value) ? value.join(', ') : String(value)));
      body.appendChild(row);
    };

    const badgeColor = ESTADO_COLORS[book.estado] || 'badge-blue';
    body.appendChild(el('span', { className: `badge ${badgeColor}`, style: { marginBottom: '12px', display: 'inline-block' } }, book.estado || ''));

    addRow('Autor',       book.autor);
    addRow('Tipo',        book.tipo);
    addRow('Calificación', book.calificacion);
    addRow('Año leído',   book.anoLeido);
    addRow('Fecha leído', book.fechaLeido?.start);
    addRow('Veces leído', book.vecesLeido > 0 ? book.vecesLeido : null);
    addRow('Lo tengo en', book.loTengoEn);
    addRow('Tags',        book.tags);
    addRow('Trozeable',   book.trozeable);
    addRow('Contexto',    book.multiSelect);
    addRow('Recomendado', book.recomendado);
    if (book.enlace) {
      const linkDiv = el('div', { style: { marginTop: '8px' } });
      linkDiv.appendChild(el('a', { href: book.enlace, target: '_blank', style: { color: 'var(--accent-blue)', fontSize: '0.85rem' } }, 'Open link'));
      body.appendChild(linkDiv);
    }

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Close'),
      el('button', { className: 'btn btn-ghost', onClick: () => { overlay.remove(); this.showForm(book); } }, 'Edit'),
      el('button', { className: 'btn btn-danger', onClick: () => {
        if (confirm(`Delete "${book.title}"?`)) { Store.deleteItem('books', book.id); overlay.remove(); }
      }}, 'Delete')
    ]);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  showForm(existing = null) {
    const old = document.getElementById('book-form-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'book-form-modal' });
    const modal = el('div', { className: 'modal', style: { maxWidth: '520px' } });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, existing ? 'Edit Book' : 'Add Book'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const addGroup = (label, id, type = 'text', value = '', placeholder = '') => {
      const g = el('div', { className: 'form-group' }, [
        el('label', { className: 'form-label' }, label),
        el('input', { className: 'form-input', id, type, value, placeholder })
      ]);
      body.appendChild(g);
    };

    addGroup('Title', 'book-title', 'text', existing?.title || '', 'Book title...');
    addGroup('Author(s) — comma separated', 'book-autor', 'text', (existing?.autor || []).join(', '), 'Author name...');

    const row1 = el('div', { className: 'form-row' });
    row1.appendChild(el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Status'),
      el('select', { className: 'form-select', id: 'book-estado' },
        ESTADOS.map(e => el('option', { value: e }, e))
      )
    ]));
    row1.appendChild(el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Type'),
      el('select', { className: 'form-select', id: 'book-tipo' },
        TIPOS.map(t => el('option', { value: t }, t))
      )
    ]));
    body.appendChild(row1);

    const row2 = el('div', { className: 'form-row' });
    row2.appendChild(el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Rating'),
      el('select', { className: 'form-select', id: 'book-rating' },
        RATING_OPTIONS.map(r => el('option', { value: r }, r || '— None —'))
      )
    ]));
    row2.appendChild(el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Year read'),
      el('input', { className: 'form-input', id: 'book-year', type: 'text', value: existing?.anoLeido || '', placeholder: '2025' })
    ]));
    body.appendChild(row2);

    addGroup('Tags — comma separated', 'book-tags', 'text', (existing?.tags || []).join(', '), 'Fiction, Philosophy...');
    addGroup('Link', 'book-enlace', 'url', existing?.enlace || '', 'https://...');
    addGroup('I have it on — comma separated', 'book-tengo', 'text', (existing?.loTengoEn || []).join(', '), 'Kindle, Físico...');
    addGroup('Cover image URL', 'book-cover', 'url', existing?.coverUrl || '', 'https://covers.openlibrary.org/b/id/...');

    const recoGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Recommended / Found in...'),
      el('textarea', { className: 'form-textarea', id: 'book-reco', placeholder: 'Where did you find this book?' })
    ]);
    body.appendChild(recoGroup);

    // Set select values after mount
    setTimeout(() => {
      if (existing) {
        document.getElementById('book-estado').value = existing.estado || 'Wishlist';
        document.getElementById('book-tipo').value   = existing.tipo   || 'Otro';
        document.getElementById('book-rating').value = existing.calificacion || '';
      }
      const recoTA = document.getElementById('book-reco');
      if (recoTA) recoTA.value = existing?.recomendado || '';
    }, 0);

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Cancel'),
      el('button', { className: 'btn btn-primary', onClick: () => {
        const title = document.getElementById('book-title').value.trim();
        if (!title) return;
        const data = {
          title,
          autor:       document.getElementById('book-autor').value.split(',').map(s => s.trim()).filter(Boolean),
          estado:      document.getElementById('book-estado').value,
          tipo:        document.getElementById('book-tipo').value,
          calificacion:document.getElementById('book-rating').value,
          anoLeido:    document.getElementById('book-year').value.trim(),
          tags:        document.getElementById('book-tags').value.split(',').map(s => s.trim()).filter(Boolean),
          enlace:      document.getElementById('book-enlace').value.trim(),
          loTengoEn:   document.getElementById('book-tengo').value.split(',').map(s => s.trim()).filter(Boolean),
          coverUrl:    document.getElementById('book-cover').value.trim(),
          recomendado: document.getElementById('book-reco').value.trim(),
          source:      'manual'
        };
        if (existing) {
          Store.updateItem('books', existing.id, data);
        } else {
          Store.addItem('books', data);
        }
        overlay.remove();
      }}, existing ? 'Save' : 'Add Book')
    ]);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('book-title')?.focus(), 100);
  },

  async importNotionBooks() {
    const btn = document.activeElement;
    if (btn) btn.disabled = true;

    try {
      const resp = await fetch('./data/notion-books.json');
      if (!resp.ok) throw new Error('Could not load notion-books.json');
      const data = await resp.json();
      const books = data.books || [];

      const existing = Store.getCategory('books');
      const existingTitles = new Set(existing.map(b => b.title?.toLowerCase().trim()));

      let added = 0;
      for (const book of books) {
        const key = (book.title || '').toLowerCase().trim();
        if (!existingTitles.has(key)) {
          Store.addItem('books', {
            ...book,
            id: undefined  // let Store generate a new id
          });
          existingTitles.add(key);
          added++;
        }
      }

      alert(`Imported ${added} books from Notion (${books.length - added} already existed).`);
    } catch (e) {
      alert('Import failed: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  renderSummary(container) {
    const books   = Store.getCategory('books');
    const reading = books.filter(b => b.estado === 'Leyendo' || b.estado === 'Re-leyendo');
    const read    = books.filter(b => b.estado === 'Leído');

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-yellow)' } });
    card.dataset.section = 'books';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(251, 191, 36, 0.1)', color: 'var(--accent-yellow)' } });
    iconWrap.appendChild(icon('notes'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Libros'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' },
      reading.length ? `Leyendo ${reading.length}` : `${read.length} leídos`
    ));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      reading.length
        ? reading.map(b => b.title).join(', ').substring(0, 60)
        : `${books.length} libros en total`
    ));

    container.appendChild(card);
  }
};
