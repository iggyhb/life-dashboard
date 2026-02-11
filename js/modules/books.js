import { Store } from '../store.js';
import { el, icon, clear } from '../utils/dom.js';
import { formatDate } from '../utils/date.js';

const ESTADOS = ['Leyendo', 'Por leer', 'Leído', 'Wishlist'];
const TIPOS = ['Espiritual', 'Cultura', 'Autoayuda', 'Otro'];
const ESTADO_COLORS = {
  'Leyendo': 'badge-blue',
  'Por leer': 'badge-orange',
  'Leído': 'badge-green',
  'Wishlist': 'badge-purple'
};
const TIPO_COLORS = {
  'Espiritual': 'badge-purple',
  'Cultura': 'badge-yellow',
  'Autoayuda': 'badge-orange',
  'Otro': 'badge-blue'
};

const RATING_OPTIONS = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export default {
  id: 'books',
  label: 'Books',
  icon: 'book',
  color: 'var(--accent-yellow)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Libros'),
      el('button', { className: 'btn btn-primary', onClick: () => this.showForm() }, [
        icon('plus'),
        'Add Book'
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

    const list = el('div');
    container.appendChild(list);

    let activeFilter = 'all';
    let searchTerm = '';

    const buildFilters = () => {
      clear(filterRow);
      const books = Store.getCategory('books');
      const counts = { all: books.length };
      for (const e of ESTADOS) {
        counts[e] = books.filter(b => b.estado === e).length;
      }

      const makeTab = (key, label) => {
        const count = counts[key] || 0;
        const tab = el('button', {
          className: `tab ${activeFilter === key ? 'active' : ''}`,
          dataset: { tab: key },
          onClick: () => {
            activeFilter = key;
            buildFilters();
            renderList();
          }
        }, `${label} (${count})`);
        return tab;
      };

      filterRow.appendChild(makeTab('all', 'All'));
      for (const e of ESTADOS) {
        filterRow.appendChild(makeTab(e, e));
      }
    };

    const renderStats = () => {
      clear(stats);
      const books = Store.getCategory('books');
      const read = books.filter(b => b.estado === 'Leído').length;
      const reading = books.filter(b => b.estado === 'Leyendo').length;
      const toRead = books.filter(b => b.estado === 'Por leer').length;
      const wishlist = books.filter(b => b.estado === 'Wishlist').length;

      const grid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '8px',
          marginBottom: '16px'
        }
      });

      const makeStat = (label, value, color) => {
        const card = el('div', {
          className: 'card',
          style: { textAlign: 'center', padding: '12px 8px' }
        });
        card.appendChild(el('div', {
          style: { fontSize: '1.3rem', fontWeight: '700', color }
        }, String(value)));
        card.appendChild(el('div', {
          style: { fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }
        }, label));
        return card;
      };

      grid.appendChild(makeStat('Total', books.length, 'var(--text-primary)'));
      grid.appendChild(makeStat('Leído', read, 'var(--accent-green)'));
      grid.appendChild(makeStat('Leyendo', reading, 'var(--accent-blue)'));
      grid.appendChild(makeStat('Por leer', toRead, 'var(--accent-orange)'));
      grid.appendChild(makeStat('Wishlist', wishlist, 'var(--accent-purple)'));

      stats.appendChild(grid);
    };

    const renderList = () => {
      clear(list);
      let books = Store.getCategory('books');

      // Filter by estado
      if (activeFilter !== 'all') {
        books = books.filter(b => b.estado === activeFilter);
      }

      // Filter by search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        books = books.filter(b =>
          (b.title || '').toLowerCase().includes(s) ||
          (b.autor || []).some(a => a.toLowerCase().includes(s)) ||
          (b.tags || []).some(t => t.toLowerCase().includes(s)) ||
          (b.tipo || '').toLowerCase().includes(s) ||
          (b.recomendado || '').toLowerCase().includes(s)
        );
      }

      // Sort: Leyendo first, then Por leer, then Leído by date desc, then Wishlist
      const estadoOrder = { 'Leyendo': 0, 'Por leer': 1, 'Leído': 2, 'Wishlist': 3 };
      books.sort((a, b) => {
        const oa = estadoOrder[a.estado] ?? 9;
        const ob = estadoOrder[b.estado] ?? 9;
        if (oa !== ob) return oa - ob;
        // Within same estado, sort by date desc
        return (b.fechaLeido || b.createdAt || '').localeCompare(a.fechaLeido || a.createdAt || '');
      });

      if (books.length === 0) {
        list.appendChild(el('div', { className: 'empty-state' }, [
          icon('notes'),
          el('h3', {}, searchTerm ? 'No matching books' : 'No books yet'),
          el('p', {}, searchTerm ? 'Try a different search' : 'Add books or use the dump box')
        ]));
        return;
      }

      for (const book of books) {
        list.appendChild(this.renderBookCard(book));
      }
    };

    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderList();
    });

    buildFilters();
    renderStats();
    renderList();

    const unsub = Store.on('books', () => {
      buildFilters();
      renderStats();
      renderList();
    });
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderBookCard(book) {
    const card = el('div', { className: 'list-item', style: { alignItems: 'flex-start', gap: '14px' } });

    // Book icon/cover placeholder
    const bookIcon = el('div', {
      style: {
        width: '40px', height: '52px', borderRadius: '4px',
        background: 'linear-gradient(135deg, var(--bg-card-hover), var(--border))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: '1.2rem'
      }
    }, '📖');

    const content = el('div', { className: 'list-item-content', style: { minWidth: 0 } });

    // Title
    const titleRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } });
    titleRow.appendChild(el('span', { className: 'list-item-title', style: { fontWeight: '600' } }, book.title || 'Untitled'));
    if (book.estado) {
      titleRow.appendChild(el('span', { className: `badge ${ESTADO_COLORS[book.estado] || 'badge-blue'}` }, book.estado));
    }
    content.appendChild(titleRow);

    // Author + Type
    const meta = el('div', { className: 'list-item-meta', style: { marginTop: '4px' } });
    const parts = [];
    if (book.autor && book.autor.length) parts.push(book.autor.join(', '));
    if (book.tipo) parts.push(book.tipo);
    meta.textContent = parts.join(' · ');
    content.appendChild(meta);

    // Tags + Rating
    const tagsRow = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' } });
    if (book.calificacion) {
      tagsRow.appendChild(el('span', { style: { fontSize: '0.75rem' } }, book.calificacion));
    }
    for (const t of (book.tags || [])) {
      tagsRow.appendChild(el('span', { className: 'tag' }, t));
    }
    if (book.anoLeido) {
      tagsRow.appendChild(el('span', { className: 'tag' }, book.anoLeido));
    }
    if (book.loTengoEn && book.loTengoEn.length) {
      for (const l of book.loTengoEn) {
        tagsRow.appendChild(el('span', { className: 'tag', style: { background: 'rgba(74, 158, 255, 0.1)' } }, l));
      }
    }
    content.appendChild(tagsRow);

    // Actions
    const actions = el('div', { className: 'list-item-actions', style: { alignSelf: 'flex-start' } });
    if (book.enlace) {
      const linkBtn = el('button', { className: 'btn-icon', title: 'Open link', onClick: (e) => {
        e.stopPropagation();
        window.open(book.enlace, '_blank');
      }});
      const linkSvg = icon('zap');
      linkSvg.style.width = '14px';
      linkSvg.style.height = '14px';
      linkBtn.appendChild(linkSvg);
      actions.appendChild(linkBtn);
    }

    const editBtn = el('button', { className: 'btn-icon', onClick: (e) => {
      e.stopPropagation();
      this.showForm(book);
    }});
    editBtn.appendChild(icon('edit'));
    actions.appendChild(editBtn);

    const delBtn = el('button', { className: 'btn-icon', onClick: (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${book.title}"?`)) Store.deleteItem('books', book.id);
    }});
    delBtn.appendChild(icon('trash'));
    actions.appendChild(delBtn);

    card.appendChild(bookIcon);
    card.appendChild(content);
    card.appendChild(actions);

    return card;
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

    const titleGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', id: 'book-title', type: 'text', value: existing?.title || '', placeholder: 'Book title...' })
    ]);

    const autorGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Author(s) — comma separated'),
      el('input', { className: 'form-input', id: 'book-autor', type: 'text', value: (existing?.autor || []).join(', '), placeholder: 'Author name...' })
    ]);

    const row1 = el('div', { className: 'form-row' });
    const estadoGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Status'),
      el('select', { className: 'form-select', id: 'book-estado' },
        ESTADOS.map(e => el('option', { value: e }, e))
      )
    ]);
    const tipoGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Type'),
      el('select', { className: 'form-select', id: 'book-tipo' },
        TIPOS.map(t => el('option', { value: t }, t))
      )
    ]);
    row1.appendChild(estadoGroup);
    row1.appendChild(tipoGroup);

    const row2 = el('div', { className: 'form-row' });
    const ratingGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Rating'),
      el('select', { className: 'form-select', id: 'book-rating' },
        RATING_OPTIONS.map((r, i) => el('option', { value: r }, r || '— None —'))
      )
    ]);
    const yearGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Year read'),
      el('input', { className: 'form-input', id: 'book-year', type: 'text', value: existing?.anoLeido || '', placeholder: '2025' })
    ]);
    row2.appendChild(ratingGroup);
    row2.appendChild(yearGroup);

    const tagsGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Tags — comma separated'),
      el('input', { className: 'form-input', id: 'book-tags', type: 'text', value: (existing?.tags || []).join(', '), placeholder: 'Fiction, Philosophy...' })
    ]);

    const enlaceGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Link'),
      el('input', { className: 'form-input', id: 'book-enlace', type: 'url', value: existing?.enlace || '', placeholder: 'https://...' })
    ]);

    const tengoGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'I have it on — comma separated'),
      el('input', { className: 'form-input', id: 'book-tengo', type: 'text', value: (existing?.loTengoEn || []).join(', '), placeholder: 'Kindle, Physical, Audible...' })
    ]);

    const recoGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Recommended / Found in...'),
      el('textarea', { className: 'form-textarea', id: 'book-reco', placeholder: 'Where did you find this book?' })
    ]);

    body.appendChild(titleGroup);
    body.appendChild(autorGroup);
    body.appendChild(row1);
    body.appendChild(row2);
    body.appendChild(tagsGroup);
    body.appendChild(enlaceGroup);
    body.appendChild(tengoGroup);
    body.appendChild(recoGroup);

    // Set values after mount
    setTimeout(() => {
      if (existing) {
        document.getElementById('book-estado').value = existing.estado || 'Wishlist';
        document.getElementById('book-tipo').value = existing.tipo || 'Otro';
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
          autor: document.getElementById('book-autor').value.split(',').map(s => s.trim()).filter(Boolean),
          estado: document.getElementById('book-estado').value,
          tipo: document.getElementById('book-tipo').value,
          calificacion: document.getElementById('book-rating').value,
          anoLeido: document.getElementById('book-year').value.trim(),
          tags: document.getElementById('book-tags').value.split(',').map(s => s.trim()).filter(Boolean),
          enlace: document.getElementById('book-enlace').value.trim(),
          loTengoEn: document.getElementById('book-tengo').value.split(',').map(s => s.trim()).filter(Boolean),
          recomendado: document.getElementById('book-reco').value.trim(),
          source: 'manual'
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

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('book-title')?.focus(), 100);
  },

  renderSummary(container) {
    const books = Store.getCategory('books');
    const reading = books.filter(b => b.estado === 'Leyendo');
    const read = books.filter(b => b.estado === 'Leído');

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-yellow)' } });
    card.dataset.section = 'books';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(251, 191, 36, 0.1)', color: 'var(--accent-yellow)' } });
    iconWrap.appendChild(icon('notes'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Libros'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' },
      reading.length ? `Reading ${reading.length}` : `${read.length} read`
    ));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      reading.length ? reading.map(b => b.title).join(', ').substring(0, 50) :
      `${books.length} total in library`
    ));

    container.appendChild(card);
  }
};
