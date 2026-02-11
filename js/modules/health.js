import { Store } from '../store.js';
import { el, icon, clear, createSparkline } from '../utils/dom.js';
import { formatDate, today, isThisWeek } from '../utils/date.js';

const ACTIVITIES = ['running', 'gym', 'yoga', 'cycling', 'swimming', 'walking', 'other'];

export default {
  id: 'health',
  label: 'Health',
  icon: 'health',
  color: 'var(--accent-orange)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Health & Fitness'),
      el('button', { className: 'btn btn-primary', onClick: () => this.showForm() }, [
        icon('plus'),
        'Log'
      ])
    ]);
    container.appendChild(header);

    // Metric cards
    const metrics = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' } });
    container.appendChild(metrics);

    // Tabs
    const tabs = el('div', { className: 'tabs' });
    const allTab = el('button', { className: 'tab active', dataset: { tab: 'all' } }, 'All');
    const workoutTab = el('button', { className: 'tab', dataset: { tab: 'workout' } }, 'Workouts');
    const weightTab = el('button', { className: 'tab', dataset: { tab: 'weight' } }, 'Weight');
    const sleepTab = el('button', { className: 'tab', dataset: { tab: 'sleep' } }, 'Sleep');
    tabs.appendChild(allTab);
    tabs.appendChild(workoutTab);
    tabs.appendChild(weightTab);
    tabs.appendChild(sleepTab);
    container.appendChild(tabs);

    const list = el('div');
    container.appendChild(list);

    let activeTab = 'all';

    const switchTab = (tab) => {
      activeTab = tab;
      tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      renderList();
    };

    [allTab, workoutTab, weightTab, sleepTab].forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    const renderMetrics = () => {
      clear(metrics);
      const items = Store.getCategory('health');

      // Latest weight
      const weights = items.filter(i => i.type === 'weight').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const latestWeight = weights[0];
      const weightValues = weights.slice(0, 10).reverse().map(w => w.value).filter(Boolean);

      const weightCard = el('div', { className: 'card', style: { textAlign: 'center', padding: '16px' } });
      weightCard.appendChild(el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' } }, 'Weight'));
      weightCard.appendChild(el('div', { style: { fontSize: '1.3rem', fontWeight: '700' } }, latestWeight ? `${latestWeight.value} ${latestWeight.unit || 'kg'}` : '—'));
      if (weightValues.length > 1) {
        weightCard.appendChild(createSparkline(weightValues, 80, 24, 'var(--accent-orange)'));
      }
      metrics.appendChild(weightCard);

      // Latest sleep
      const sleepItems = items.filter(i => i.type === 'sleep').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const latestSleep = sleepItems[0];

      const sleepCard = el('div', { className: 'card', style: { textAlign: 'center', padding: '16px' } });
      sleepCard.appendChild(el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' } }, 'Sleep'));
      sleepCard.appendChild(el('div', { style: { fontSize: '1.3rem', fontWeight: '700' } }, latestSleep ? `${latestSleep.hours}h` : '—'));
      if (latestSleep?.quality) {
        sleepCard.appendChild(el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)' } }, latestSleep.quality));
      }
      metrics.appendChild(sleepCard);

      // Workouts this week
      const weekWorkouts = items.filter(i => i.type === 'workout' && isThisWeek(i.date));
      const workoutCard = el('div', { className: 'card', style: { textAlign: 'center', padding: '16px' } });
      workoutCard.appendChild(el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' } }, 'Workouts'));
      workoutCard.appendChild(el('div', { style: { fontSize: '1.3rem', fontWeight: '700' } }, `${weekWorkouts.length} this week`));
      metrics.appendChild(workoutCard);
    };

    const renderList = () => {
      clear(list);
      let items = Store.getCategory('health');
      if (activeTab !== 'all') {
        items = items.filter(i => i.type === activeTab);
      }

      items.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));

      if (items.length === 0) {
        list.appendChild(el('div', { className: 'empty-state' }, [
          icon('health'),
          el('h3', {}, 'No entries yet'),
          el('p', {}, 'Log your workouts, weight, sleep, and more')
        ]));
        return;
      }

      for (const item of items) {
        list.appendChild(this.renderItem(item));
      }
    };

    renderMetrics();
    renderList();
    const unsub = Store.on('health', () => { renderMetrics(); renderList(); });
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderItem(item) {
    const row = el('div', { className: 'list-item' });

    const typeIcons = { workout: 'zap', weight: 'health', sleep: 'home', meal: 'star', metric: 'health' };
    const typeColors = {
      workout: { bg: 'rgba(251, 146, 60, 0.1)', fg: 'var(--accent-orange)' },
      weight: { bg: 'rgba(167, 139, 250, 0.1)', fg: 'var(--accent-purple)' },
      sleep: { bg: 'rgba(74, 158, 255, 0.1)', fg: 'var(--accent-blue)' },
      meal: { bg: 'rgba(52, 211, 153, 0.1)', fg: 'var(--accent-green)' },
      metric: { bg: 'rgba(251, 191, 36, 0.1)', fg: 'var(--accent-yellow)' }
    };

    const colors = typeColors[item.type] || typeColors.metric;
    const iconEl = el('div', {
      style: {
        width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colors.bg, color: colors.fg, flexShrink: 0
      }
    });
    const svg = icon(typeIcons[item.type] || 'health');
    svg.style.width = '16px';
    svg.style.height = '16px';
    iconEl.appendChild(svg);

    const content = el('div', { className: 'list-item-content' });

    let titleText = item.type || 'Entry';
    if (item.type === 'workout') {
      titleText = (item.activity || 'Workout').charAt(0).toUpperCase() + (item.activity || 'workout').slice(1);
    } else if (item.type === 'weight') {
      titleText = `Weight: ${item.value || '?'} ${item.unit || 'kg'}`;
    } else if (item.type === 'sleep') {
      titleText = `Sleep: ${item.hours || '?'}h${item.quality ? ` (${item.quality})` : ''}`;
    }

    content.appendChild(el('div', { className: 'list-item-title' }, titleText));

    const meta = el('div', { className: 'list-item-meta' });
    const details = [];
    if (item.duration) details.push(`${item.duration} min`);
    if (item.distance) details.push(`${item.distance} km`);
    if (item.notes && item.notes.length <= 60) details.push(item.notes);
    else if (item.notes) details.push(item.notes.substring(0, 60) + '...');
    if (details.length) meta.textContent = details.join(' · ');
    else meta.textContent = formatDate(item.date || item.createdAt);
    content.appendChild(meta);

    const dateLabel = el('div', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' } }, formatDate(item.date || item.createdAt));

    const actions = el('div', { className: 'list-item-actions' });
    const delBtn = el('button', { className: 'btn-icon', onClick: () => {
      if (confirm('Delete this entry?')) Store.deleteItem('health', item.id);
    }});
    delBtn.appendChild(icon('trash'));
    actions.appendChild(delBtn);

    row.appendChild(iconEl);
    row.appendChild(content);
    row.appendChild(dateLabel);
    row.appendChild(actions);

    return row;
  },

  showForm(existing = null) {
    const old = document.getElementById('health-form-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'health-form-modal' });
    const modal = el('div', { className: 'modal' });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, existing ? 'Edit Entry' : 'Log Health'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const typeGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Type'),
      el('select', { className: 'form-select', id: 'health-type' }, [
        el('option', { value: 'workout' }, 'Workout'),
        el('option', { value: 'weight' }, 'Weight'),
        el('option', { value: 'sleep' }, 'Sleep'),
        el('option', { value: 'meal' }, 'Meal'),
        el('option', { value: 'metric' }, 'Other Metric')
      ])
    ]);

    const dateGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Date'),
      el('input', { className: 'form-input', id: 'health-date', type: 'date', value: existing?.date || today() })
    ]);

    // Dynamic fields container
    const dynamicFields = el('div', { id: 'health-dynamic-fields' });

    const notesGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Notes'),
      el('input', { className: 'form-input', id: 'health-notes', type: 'text', value: existing?.notes || '', placeholder: 'Optional notes...' })
    ]);

    body.appendChild(typeGroup);
    body.appendChild(dateGroup);
    body.appendChild(dynamicFields);
    body.appendChild(notesGroup);

    const updateFields = (type) => {
      clear(dynamicFields);
      if (type === 'workout') {
        dynamicFields.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Activity'),
          el('select', { className: 'form-select', id: 'health-activity' },
            ACTIVITIES.map(a => el('option', { value: a }, a.charAt(0).toUpperCase() + a.slice(1)))
          )
        ]));
        const row = el('div', { className: 'form-row' });
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Duration (min)'),
          el('input', { className: 'form-input', id: 'health-duration', type: 'number', value: existing?.duration || '', placeholder: '30' })
        ]));
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Distance (km)'),
          el('input', { className: 'form-input', id: 'health-distance', type: 'number', step: '0.1', value: existing?.distance || '', placeholder: '5.0' })
        ]));
        dynamicFields.appendChild(row);
        if (existing?.activity) {
          setTimeout(() => { document.getElementById('health-activity').value = existing.activity; }, 0);
        }
      } else if (type === 'weight') {
        const row = el('div', { className: 'form-row' });
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Weight'),
          el('input', { className: 'form-input', id: 'health-value', type: 'number', step: '0.1', value: existing?.value || '', placeholder: '75.0' })
        ]));
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Unit'),
          el('select', { className: 'form-select', id: 'health-unit' }, [
            el('option', { value: 'kg' }, 'kg'),
            el('option', { value: 'lbs' }, 'lbs')
          ])
        ]));
        dynamicFields.appendChild(row);
      } else if (type === 'sleep') {
        const row = el('div', { className: 'form-row' });
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Hours'),
          el('input', { className: 'form-input', id: 'health-hours', type: 'number', step: '0.5', value: existing?.hours || '', placeholder: '7.5' })
        ]));
        row.appendChild(el('div', { className: 'form-group' }, [
          el('label', { className: 'form-label' }, 'Quality'),
          el('select', { className: 'form-select', id: 'health-quality' }, [
            el('option', { value: '' }, 'Select...'),
            el('option', { value: 'good' }, 'Good'),
            el('option', { value: 'fair' }, 'Fair'),
            el('option', { value: 'poor' }, 'Poor')
          ])
        ]));
        dynamicFields.appendChild(row);
      }
    };

    setTimeout(() => {
      const typeSelect = document.getElementById('health-type');
      if (existing) typeSelect.value = existing.type || 'workout';
      updateFields(typeSelect.value);
      typeSelect.addEventListener('change', () => updateFields(typeSelect.value));
    }, 0);

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Cancel'),
      el('button', { className: 'btn btn-primary', onClick: () => {
        const type = document.getElementById('health-type').value;
        const date = document.getElementById('health-date').value;
        const notes = document.getElementById('health-notes').value.trim();

        const data = { type, date, notes, source: 'manual' };

        if (type === 'workout') {
          data.activity = document.getElementById('health-activity')?.value || 'other';
          data.duration = parseInt(document.getElementById('health-duration')?.value) || null;
          data.distance = parseFloat(document.getElementById('health-distance')?.value) || null;
        } else if (type === 'weight') {
          data.value = parseFloat(document.getElementById('health-value')?.value);
          if (isNaN(data.value)) return;
          data.unit = document.getElementById('health-unit')?.value || 'kg';
        } else if (type === 'sleep') {
          data.hours = parseFloat(document.getElementById('health-hours')?.value);
          if (isNaN(data.hours)) return;
          data.quality = document.getElementById('health-quality')?.value || null;
        }

        if (existing) {
          Store.updateItem('health', existing.id, data);
        } else {
          Store.addItem('health', data);
        }
        overlay.remove();
      }}, existing ? 'Save' : 'Log')
    ]);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  },

  renderSummary(container) {
    const items = Store.getCategory('health');
    const weekWorkouts = items.filter(i => i.type === 'workout' && isThisWeek(i.date));
    const latestWeight = items.filter(i => i.type === 'weight').sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-orange)' } });
    card.dataset.section = 'health';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(251, 146, 60, 0.1)', color: 'var(--accent-orange)' } });
    iconWrap.appendChild(icon('health'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Health'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' }, `${weekWorkouts.length} workouts`));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      latestWeight ? `Weight: ${latestWeight.value} ${latestWeight.unit || 'kg'}` : 'This week'
    ));

    container.appendChild(card);
  }
};
