import { Store } from '../store.js';
import { el, icon, clear } from '../utils/dom.js';
import { formatDate, formatCurrency, isThisMonth, isThisWeek } from '../utils/date.js';

const EXPENSE_CATEGORIES = ['food', 'transport', 'rent', 'entertainment', 'shopping', 'health', 'subscriptions', 'utilities', 'other'];

export default {
  id: 'finances',
  label: 'Finances',
  icon: 'finances',
  color: 'var(--accent-green)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Finances'),
      el('button', { className: 'btn btn-primary', onClick: () => this.showForm(container) }, [
        icon('plus'),
        'Add Transaction'
      ])
    ]);
    container.appendChild(header);

    // Monthly summary
    const summary = el('div', { style: { marginBottom: '24px' } });
    container.appendChild(summary);

    const list = el('div');
    container.appendChild(list);

    const render = () => {
      this.renderMonthlySummary(summary);
      this.renderTransactionList(list);
    };

    render();
    const unsub = Store.on('finances', render);
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderMonthlySummary(container) {
    clear(container);
    const items = Store.getCategory('finances').filter(i => isThisMonth(i.date));
    const income = items.filter(i => i.type === 'income').reduce((s, i) => s + (i.amount || 0), 0);
    const expenses = items.filter(i => i.type === 'expense').reduce((s, i) => s + (i.amount || 0), 0);
    const net = income - expenses;

    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' } });

    const makeCard = (label, value, color) => {
      const c = el('div', { className: 'card', style: { textAlign: 'center', padding: '16px' } });
      c.appendChild(el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' } }, label));
      c.appendChild(el('div', { style: { fontSize: '1.3rem', fontWeight: '700', color } }, formatCurrency(value)));
      return c;
    };

    grid.appendChild(makeCard('Income', income, 'var(--accent-green)'));
    grid.appendChild(makeCard('Expenses', expenses, 'var(--accent-red)'));
    grid.appendChild(makeCard('Net', net, net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'));

    container.appendChild(el('h3', { style: { fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' } }, 'This Month'));
    container.appendChild(grid);

    // Category breakdown
    if (expenses > 0) {
      const byCategory = {};
      for (const item of items.filter(i => i.type === 'expense')) {
        const cat = item.category || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + item.amount;
      }

      const breakdown = el('div', { style: { marginTop: '8px' } });
      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      const colors = {
        food: 'var(--accent-orange)', transport: 'var(--accent-blue)',
        rent: 'var(--accent-red)', entertainment: 'var(--accent-purple)',
        shopping: 'var(--accent-yellow)', health: 'var(--accent-green)',
        subscriptions: '#e879f9', utilities: '#67e8f9', other: 'var(--text-muted)'
      };

      for (const [cat, amount] of sorted) {
        const pct = (amount / expenses * 100).toFixed(0);
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } });
        row.appendChild(el('span', { style: { width: '90px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' } }, cat));
        const bar = el('div', { className: 'finance-bar', style: { flex: 1 } });
        bar.appendChild(el('div', { className: 'finance-bar-fill', style: { width: `${pct}%`, background: colors[cat] || 'var(--text-muted)' } }));
        row.appendChild(bar);
        row.appendChild(el('span', { style: { width: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' } }, formatCurrency(amount)));
        breakdown.appendChild(row);
      }

      container.appendChild(breakdown);
    }
  },

  renderTransactionList(container) {
    clear(container);
    const items = Store.getCategory('finances');

    if (items.length === 0) {
      container.appendChild(el('div', { className: 'empty-state' }, [
        icon('finances'),
        el('h3', {}, 'No transactions yet'),
        el('p', {}, 'Add transactions or use the dump box')
      ]));
      return;
    }

    // Group by date
    const grouped = {};
    for (const item of items) {
      const date = item.date || 'Unknown';
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    }

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      container.appendChild(el('div', {
        style: { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: '600' }
      }, formatDate(date)));

      for (const item of grouped[date]) {
        const row = el('div', { className: 'list-item' });

        const typeIcon = item.type === 'income' ? 'plus' : 'finances';
        const iconEl = el('div', {
          style: {
            width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: item.type === 'income' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
            color: item.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)',
            flexShrink: 0
          }
        });
        const svg = icon(typeIcon);
        svg.style.width = '16px';
        svg.style.height = '16px';
        iconEl.appendChild(svg);

        const content = el('div', { className: 'list-item-content' });
        content.appendChild(el('div', { className: 'list-item-title' }, item.description || 'Transaction'));
        const meta = el('div', { className: 'list-item-meta' });
        if (item.category) meta.appendChild(el('span', { className: 'tag' }, item.category));
        content.appendChild(meta);

        const amount = el('div', {
          style: {
            fontWeight: '600', fontSize: '0.9rem',
            color: item.type === 'income' ? 'var(--accent-green)' : 'var(--text-primary)'
          }
        }, `${item.type === 'income' ? '+' : '-'}${formatCurrency(item.amount || 0, item.currency || 'EUR')}`);

        const actions = el('div', { className: 'list-item-actions' });
        const delBtn = el('button', { className: 'btn-icon', onClick: () => {
          if (confirm('Delete this transaction?')) Store.deleteItem('finances', item.id);
        }});
        delBtn.appendChild(icon('trash'));
        actions.appendChild(delBtn);

        row.appendChild(iconEl);
        row.appendChild(content);
        row.appendChild(amount);
        row.appendChild(actions);
        container.appendChild(row);
      }
    }
  },

  showForm(container, existing = null) {
    const old = document.getElementById('finance-form-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'finance-form-modal' });
    const modal = el('div', { className: 'modal' });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, existing ? 'Edit Transaction' : 'New Transaction'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const typeGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Type'),
      el('select', { className: 'form-select', id: 'fin-type' }, [
        el('option', { value: 'expense' }, 'Expense'),
        el('option', { value: 'income' }, 'Income')
      ])
    ]);

    const row1 = el('div', { className: 'form-row' });
    const amountGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Amount'),
      el('input', { className: 'form-input', id: 'fin-amount', type: 'number', step: '0.01', value: existing?.amount || '', placeholder: '0.00' })
    ]);
    const dateGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Date'),
      el('input', { className: 'form-input', id: 'fin-date', type: 'date', value: existing?.date || new Date().toISOString().split('T')[0] })
    ]);
    row1.appendChild(amountGroup);
    row1.appendChild(dateGroup);

    const catGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Category'),
      el('select', { className: 'form-select', id: 'fin-category' },
        EXPENSE_CATEGORIES.map(c => el('option', { value: c }, c.charAt(0).toUpperCase() + c.slice(1)))
      )
    ]);

    const descGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Description'),
      el('input', { className: 'form-input', id: 'fin-desc', type: 'text', value: existing?.description || '', placeholder: 'What was this for?' })
    ]);

    body.appendChild(typeGroup);
    body.appendChild(row1);
    body.appendChild(catGroup);
    body.appendChild(descGroup);

    if (existing) {
      setTimeout(() => {
        document.getElementById('fin-type').value = existing.type || 'expense';
        document.getElementById('fin-category').value = existing.category || 'other';
      }, 0);
    }

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Cancel'),
      el('button', { className: 'btn btn-primary', onClick: () => {
        const amount = parseFloat(document.getElementById('fin-amount').value);
        if (isNaN(amount) || amount <= 0) return;
        const data = {
          type: document.getElementById('fin-type').value,
          amount,
          currency: 'EUR',
          category: document.getElementById('fin-category').value,
          description: document.getElementById('fin-desc').value.trim(),
          date: document.getElementById('fin-date').value,
          recurring: false,
          source: 'manual'
        };
        if (existing) {
          Store.updateItem('finances', existing.id, data);
        } else {
          Store.addItem('finances', data);
        }
        overlay.remove();
      }}, existing ? 'Save' : 'Add')
    ]);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('fin-amount')?.focus(), 100);
  },

  renderSummary(container) {
    const items = Store.getCategory('finances').filter(i => isThisWeek(i.date));
    const expenses = items.filter(i => i.type === 'expense').reduce((s, i) => s + (i.amount || 0), 0);
    const income = items.filter(i => i.type === 'income').reduce((s, i) => s + (i.amount || 0), 0);

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-green)' } });
    card.dataset.section = 'finances';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-green)' } });
    iconWrap.appendChild(icon('finances'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Finances'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' }, formatCurrency(expenses)));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      `Spent this week${income > 0 ? ` | +${formatCurrency(income)} earned` : ''}`
    ));

    container.appendChild(card);
  }
};
