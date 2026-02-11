import { Store } from '../store.js';
import { el, icon, clear } from '../utils/dom.js';
import { formatDate } from '../utils/date.js';

export default {
  id: 'notes',
  label: 'Notes',
  icon: 'notes',
  color: 'var(--accent-purple)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Notes & Ideas'),
      el('button', { className: 'btn btn-primary', onClick: () => this.showForm(container) }, [
        icon('plus'),
        'New Note'
      ])
    ]);
    container.appendChild(header);

    // Search
    const searchWrap = el('div', { className: 'search-wrapper' });
    const searchIcon = icon('search');
    searchIcon.classList.add('search-icon');
    const searchInput = el('input', {
      className: 'search-input',
      type: 'text',
      placeholder: 'Search notes...'
    });
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    const grid = el('div', { className: 'card-grid' });
    container.appendChild(grid);

    const render = (filter = '') => {
      clear(grid);
      let items = Store.getCategory('notes');
      if (filter) {
        const f = filter.toLowerCase();
        items = items.filter(n =>
          (n.title || '').toLowerCase().includes(f) ||
          (n.body || '').toLowerCase().includes(f) ||
          (n.tags || []).some(t => t.toLowerCase().includes(f))
        );
      }

      // Pinned first
      items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

      if (items.length === 0) {
        grid.appendChild(el('div', { className: 'empty-state' }, [
          icon('notes'),
          el('h3', {}, filter ? 'No matching notes' : 'No notes yet'),
          el('p', {}, filter ? 'Try a different search term' : 'Add a note or use the dump box to capture ideas')
        ]));
        return;
      }

      for (const note of items) {
        grid.appendChild(this.renderCard(note, container));
      }
    };

    searchInput.addEventListener('input', (e) => render(e.target.value));
    render();

    const unsub = Store.on('notes', () => render(searchInput.value));
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderCard(note, container) {
    const card = el('div', { className: 'card' });

    const header = el('div', { className: 'card-header' });
    const title = el('span', { className: 'card-title' }, note.title || 'Untitled');
    const actions = el('div', { style: { display: 'flex', gap: '4px' } });

    const pinBtn = el('button', { className: 'btn-icon', title: note.pinned ? 'Unpin' : 'Pin' });
    const pinIcon = icon('star');
    if (note.pinned) pinIcon.style.color = 'var(--accent-yellow)';
    pinBtn.appendChild(pinIcon);
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Store.updateItem('notes', note.id, { pinned: !note.pinned });
    });

    const editBtn = el('button', { className: 'btn-icon', title: 'Edit' });
    editBtn.appendChild(icon('edit'));
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showForm(container, note);
    });

    const delBtn = el('button', { className: 'btn-icon', title: 'Delete' });
    delBtn.appendChild(icon('trash'));
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        Store.deleteItem('notes', note.id);
      }
    });

    actions.appendChild(pinBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    header.appendChild(title);
    header.appendChild(actions);

    const body = el('div', { className: 'card-body' },
      (note.body || '').substring(0, 150) + ((note.body || '').length > 150 ? '...' : '')
    );

    const footer = el('div', { className: 'card-footer' });
    const tags = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } });
    for (const t of (note.tags || [])) {
      tags.appendChild(el('span', { className: 'tag' }, t));
    }
    footer.appendChild(tags);
    footer.appendChild(el('span', { className: 'list-item-meta' }, formatDate(note.createdAt)));

    if (note.pinned) {
      card.style.borderColor = 'var(--accent-yellow)';
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
  },

  showForm(container, existing = null) {
    // Remove any existing modal
    const old = document.getElementById('note-form-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'note-form-modal' });
    const modal = el('div', { className: 'modal' });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, existing ? 'Edit Note' : 'New Note'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const titleGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', id: 'note-title', type: 'text', value: existing?.title || '', placeholder: 'Note title...' })
    ]);

    const bodyGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Content'),
      el('textarea', { className: 'form-textarea', id: 'note-body', placeholder: 'Write your note...', style: { minHeight: '150px' } })
    ]);

    const tagsGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Tags (comma separated)'),
      el('input', { className: 'form-input', id: 'note-tags', type: 'text', value: (existing?.tags || []).join(', '), placeholder: 'idea, project, personal...' })
    ]);

    body.appendChild(titleGroup);
    body.appendChild(bodyGroup);
    body.appendChild(tagsGroup);

    // Set textarea value after append
    setTimeout(() => {
      const ta = document.getElementById('note-body');
      if (ta) ta.value = existing?.body || '';
    }, 0);

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Cancel'),
      el('button', { className: 'btn btn-primary', onClick: () => {
        const title = document.getElementById('note-title').value.trim();
        const noteBody = document.getElementById('note-body').value.trim();
        const tags = document.getElementById('note-tags').value
          .split(',').map(t => t.trim()).filter(Boolean);

        if (!title && !noteBody) return;

        if (existing) {
          Store.updateItem('notes', existing.id, { title, body: noteBody, tags });
        } else {
          Store.addItem('notes', {
            title: title || 'Untitled',
            body: noteBody,
            tags,
            pinned: false,
            source: 'manual'
          });
        }
        overlay.remove();
      }}, existing ? 'Save' : 'Add Note')
    ]);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('note-title')?.focus(), 100);
  },

  renderSummary(container) {
    const notes = Store.getCategory('notes');
    const recent = notes.slice(0, 3);

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-purple)' } });
    card.dataset.section = 'notes';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(167, 139, 250, 0.1)', color: 'var(--accent-purple)' } });
    iconWrap.appendChild(icon('notes'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Notes'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' }, String(notes.length)));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      recent.length ? recent.map(n => n.title || 'Untitled').join(', ') : 'No notes yet'
    ));

    container.appendChild(card);
  }
};
