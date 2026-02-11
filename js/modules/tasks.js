import { Store } from '../store.js';
import { el, icon, clear } from '../utils/dom.js';
import { formatDate, today, getLast7Days } from '../utils/date.js';

export default {
  id: 'tasks',
  label: 'Tasks',
  icon: 'tasks',
  color: 'var(--accent-blue)',

  renderSection(container) {
    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Tasks & Habits'),
      el('button', { className: 'btn btn-primary', onClick: () => this.showForm(container) }, [
        icon('plus'),
        'Add'
      ])
    ]);
    container.appendChild(header);

    // Tabs
    const tabs = el('div', { className: 'tabs' });
    const taskTab = el('button', { className: 'tab active', dataset: { tab: 'tasks' } }, 'Tasks');
    const habitTab = el('button', { className: 'tab', dataset: { tab: 'habits' } }, 'Habits');
    tabs.appendChild(taskTab);
    tabs.appendChild(habitTab);
    container.appendChild(tabs);

    const content = el('div', { id: 'tasks-content' });
    container.appendChild(content);

    let activeTab = 'tasks';

    const switchTab = (tab) => {
      activeTab = tab;
      tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      render();
    };

    taskTab.addEventListener('click', () => switchTab('tasks'));
    habitTab.addEventListener('click', () => switchTab('habits'));

    const render = () => {
      clear(content);
      const items = Store.getCategory('tasks');

      if (activeTab === 'tasks') {
        this.renderTaskList(content, items.filter(i => i.type !== 'habit'));
      } else {
        this.renderHabitList(content, items.filter(i => i.type === 'habit'));
      }
    };

    render();
    const unsub = Store.on('tasks', render);
    if (window.__dashUnsubscribers) window.__dashUnsubscribers.push(unsub);
  },

  renderTaskList(container, tasks) {
    // Filter tabs
    const filterRow = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } });
    let currentFilter = 'pending';

    const filters = ['pending', 'done', 'all'];
    const filterBtns = filters.map(f => {
      const btn = el('button', {
        className: `btn btn-sm ${f === currentFilter ? 'btn-primary' : 'btn-secondary'}`,
        onClick: () => {
          currentFilter = f;
          filterBtns.forEach((b, i) => {
            b.className = `btn btn-sm ${filters[i] === f ? 'btn-primary' : 'btn-secondary'}`;
          });
          renderList();
        }
      }, f.charAt(0).toUpperCase() + f.slice(1));
      return btn;
    });
    filterBtns.forEach(b => filterRow.appendChild(b));
    container.appendChild(filterRow);

    const list = el('div');
    container.appendChild(list);

    const renderList = () => {
      clear(list);
      let filtered = tasks;
      if (currentFilter === 'pending') filtered = tasks.filter(t => t.status === 'pending');
      else if (currentFilter === 'done') filtered = tasks.filter(t => t.status === 'done');

      // Sort: pending first by priority, then by date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
      });

      if (filtered.length === 0) {
        list.appendChild(el('div', { className: 'empty-state' }, [
          icon('tasks'),
          el('h3', {}, currentFilter === 'pending' ? 'All clear!' : 'No tasks'),
          el('p', {}, 'Add tasks manually or use the dump box')
        ]));
        return;
      }

      for (const task of filtered) {
        list.appendChild(this.renderTaskItem(task));
      }
    };

    renderList();
  },

  renderTaskItem(task) {
    const item = el('div', { className: 'list-item' });

    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = task.status === 'done';
    checkbox.addEventListener('change', () => {
      Store.updateItem('tasks', task.id, { status: checkbox.checked ? 'done' : 'pending' });
    });
    const checkWrap = el('label', { className: 'checkbox' }, [checkbox]);

    const content = el('div', { className: 'list-item-content' });
    const title = el('div', { className: `list-item-title ${task.status === 'done' ? 'done' : ''}` }, task.title);
    const meta = el('div', { className: 'list-item-meta' });

    const priorityColors = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-blue' };
    meta.appendChild(el('span', { className: `badge ${priorityColors[task.priority] || 'badge-blue'}` }, task.priority || 'medium'));

    if (task.dueDate) {
      meta.appendChild(el('span', { style: { marginLeft: '8px' } }, `Due: ${formatDate(task.dueDate)}`));
    }

    content.appendChild(title);
    content.appendChild(meta);

    const actions = el('div', { className: 'list-item-actions' });
    const editBtn = el('button', { className: 'btn-icon', onClick: () => this.showForm(null, task) });
    editBtn.appendChild(icon('edit'));
    const delBtn = el('button', { className: 'btn-icon', onClick: () => {
      if (confirm('Delete this task?')) Store.deleteItem('tasks', task.id);
    }});
    delBtn.appendChild(icon('trash'));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(checkWrap);
    item.appendChild(content);
    item.appendChild(actions);

    return item;
  },

  renderHabitList(container, habits) {
    if (habits.length === 0) {
      container.appendChild(el('div', { className: 'empty-state' }, [
        icon('zap'),
        el('h3', {}, 'No habits yet'),
        el('p', {}, 'Create a habit to start tracking your daily routines')
      ]));
      return;
    }

    const grid = el('div', { className: 'card-grid' });

    for (const habit of habits) {
      const card = el('div', { className: 'card' });

      const headerEl = el('div', { className: 'card-header' });
      headerEl.appendChild(el('span', { className: 'card-title' }, habit.title));

      const freq = el('span', { className: 'badge badge-blue' }, habit.frequency || 'daily');
      headerEl.appendChild(freq);
      card.appendChild(headerEl);

      // Habit grid (last 7 days)
      const days = getLast7Days();
      const habitGrid = el('div', { className: 'habit-grid' });
      const todayStr = today();

      for (const day of days) {
        const completed = (habit.completions || []).includes(day);
        const dayEl = el('div', {
          className: `habit-day ${completed ? 'completed' : ''} ${day === todayStr ? 'today' : ''}`,
          title: day
        });
        dayEl.addEventListener('click', () => {
          const comps = habit.completions || [];
          if (comps.includes(day)) {
            Store.updateItem('tasks', habit.id, {
              completions: comps.filter(d => d !== day)
            });
          } else {
            Store.updateItem('tasks', habit.id, {
              completions: [...comps, day]
            });
          }
        });
        habitGrid.appendChild(dayEl);
      }

      card.appendChild(habitGrid);

      const todayCompleted = (habit.completions || []).includes(todayStr);
      const toggleBtn = el('button', {
        className: `btn btn-sm ${todayCompleted ? 'btn-secondary' : 'btn-primary'}`,
        style: { marginTop: '12px', width: '100%' },
        onClick: () => {
          const comps = habit.completions || [];
          if (todayCompleted) {
            Store.updateItem('tasks', habit.id, {
              completions: comps.filter(d => d !== todayStr)
            });
          } else {
            Store.updateItem('tasks', habit.id, {
              completions: [...comps, todayStr]
            });
          }
        }
      }, todayCompleted ? 'Done today' : 'Mark today');

      card.appendChild(toggleBtn);

      const footer = el('div', { className: 'card-footer' });
      const streak = this.getStreak(habit);
      footer.appendChild(el('span', { className: 'list-item-meta' }, `${streak} day streak`));

      const delBtn = el('button', { className: 'btn-icon btn-danger', onClick: () => {
        if (confirm('Delete this habit?')) Store.deleteItem('tasks', habit.id);
      }});
      delBtn.appendChild(icon('trash'));
      footer.appendChild(delBtn);

      card.appendChild(footer);
      grid.appendChild(card);
    }

    container.appendChild(grid);
  },

  getStreak(habit) {
    const comps = new Set(habit.completions || []);
    let streak = 0;
    const d = new Date();
    while (true) {
      const dateStr = d.toISOString().split('T')[0];
      if (comps.has(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  },

  showForm(container, existing = null) {
    const old = document.getElementById('task-form-modal');
    if (old) old.remove();

    const overlay = el('div', { className: 'modal-overlay open', id: 'task-form-modal' });
    const modal = el('div', { className: 'modal' });

    const header = el('div', { className: 'modal-header' }, [
      el('h2', {}, existing ? 'Edit' : 'New Task / Habit'),
      el('button', { className: 'btn-icon', onClick: () => overlay.remove() }, [icon('close')])
    ]);

    const body = el('div', { className: 'modal-body' });

    const typeGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Type'),
      el('select', { className: 'form-select', id: 'task-type' }, [
        el('option', { value: 'task' }, 'Task'),
        el('option', { value: 'habit' }, 'Habit')
      ])
    ]);

    const titleGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Title'),
      el('input', { className: 'form-input', id: 'task-title', type: 'text', value: existing?.title || '', placeholder: 'What needs to be done?' })
    ]);

    const row = el('div', { className: 'form-row' });
    const priorityGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Priority'),
      el('select', { className: 'form-select', id: 'task-priority' }, [
        el('option', { value: 'low' }, 'Low'),
        el('option', { value: 'medium', selected: true }, 'Medium'),
        el('option', { value: 'high' }, 'High')
      ])
    ]);
    const dueDateGroup = el('div', { className: 'form-group' }, [
      el('label', { className: 'form-label' }, 'Due Date'),
      el('input', { className: 'form-input', id: 'task-due', type: 'date', value: existing?.dueDate || '' })
    ]);
    row.appendChild(priorityGroup);
    row.appendChild(dueDateGroup);

    const freqGroup = el('div', { className: 'form-group', id: 'task-freq-group', style: { display: 'none' } }, [
      el('label', { className: 'form-label' }, 'Frequency'),
      el('select', { className: 'form-select', id: 'task-frequency' }, [
        el('option', { value: 'daily' }, 'Daily'),
        el('option', { value: 'weekly' }, 'Weekly')
      ])
    ]);

    body.appendChild(typeGroup);
    body.appendChild(titleGroup);
    body.appendChild(row);
    body.appendChild(freqGroup);

    // Show/hide frequency based on type
    setTimeout(() => {
      const typeSelect = document.getElementById('task-type');
      const freqGroupEl = document.getElementById('task-freq-group');
      if (existing) {
        typeSelect.value = existing.type || 'task';
        document.getElementById('task-priority').value = existing.priority || 'medium';
        if (existing.frequency) document.getElementById('task-frequency').value = existing.frequency;
      }
      freqGroupEl.style.display = typeSelect.value === 'habit' ? 'block' : 'none';
      typeSelect.addEventListener('change', () => {
        freqGroupEl.style.display = typeSelect.value === 'habit' ? 'block' : 'none';
      });
    }, 0);

    const footer = el('div', { className: 'modal-footer' }, [
      el('button', { className: 'btn btn-secondary', onClick: () => overlay.remove() }, 'Cancel'),
      el('button', { className: 'btn btn-primary', onClick: () => {
        const title = document.getElementById('task-title').value.trim();
        if (!title) return;
        const type = document.getElementById('task-type').value;
        const priority = document.getElementById('task-priority').value;
        const dueDate = document.getElementById('task-due').value || null;
        const frequency = type === 'habit' ? document.getElementById('task-frequency').value : null;

        if (existing) {
          Store.updateItem('tasks', existing.id, { title, type, priority, dueDate, frequency });
        } else {
          Store.addItem('tasks', {
            type,
            title,
            description: '',
            status: 'pending',
            priority,
            dueDate,
            tags: [],
            frequency,
            completions: [],
            source: 'manual'
          });
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
    setTimeout(() => document.getElementById('task-title')?.focus(), 100);
  },

  renderSummary(container) {
    const items = Store.getCategory('tasks');
    const pending = items.filter(t => t.type !== 'habit' && t.status === 'pending');
    const todayStr = today();
    const habitsToday = items.filter(t => t.type === 'habit');
    const habitsDone = habitsToday.filter(h => (h.completions || []).includes(todayStr));

    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-blue)' } });
    card.dataset.section = 'tasks';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(74, 158, 255, 0.1)', color: 'var(--accent-blue)' } });
    iconWrap.appendChild(icon('tasks'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Tasks'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' }, `${pending.length} pending`));
    card.appendChild(el('div', { className: 'summary-card-detail' },
      habitsToday.length ? `Habits: ${habitsDone.length}/${habitsToday.length} today` : 'No habits set'
    ));

    container.appendChild(card);
  }
};
