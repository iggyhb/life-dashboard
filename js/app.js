import { Store } from './store.js';
import { initDumpBox } from './dumpbox.js';
import { el, icon, clear } from './utils/dom.js';
import { formatDate } from './utils/date.js';

// Import modules
import tasksModule from './modules/tasks.js';
import financesModule from './modules/finances.js';
import healthModule from './modules/health.js';
import notesModule from './modules/notes.js';
import booksModule from './modules/books.js';
import feedModule from './modules/feed.js';

// ── Module Registry ──
const modules = new Map();
const moduleOrder = [];

function registerModule(mod) {
  modules.set(mod.id, mod);
  moduleOrder.push(mod.id);
}

[feedModule, tasksModule, financesModule, healthModule, notesModule, booksModule].forEach(registerModule);

// ── Listener Cleanup ──
// Track active unsubscribe functions so we can clean up on navigate
let activeUnsubscribers = [];

function cleanupListeners() {
  for (const unsub of activeUnsubscribers) {
    unsub();
  }
  activeUnsubscribers = [];
}

// ── Routing ──
let currentSection = 'home';

function navigate(section) {
  // Clean up old listeners before switching
  cleanupListeners();

  currentSection = section;

  // Update nav active states
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === section);
  });
  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.section === section);
  });

  // Render section
  const main = document.getElementById('main-content');
  clear(main);

  if (section === 'home') {
    renderHome(main);
  } else {
    const mod = modules.get(section);
    if (mod) {
      const sectionEl = el('div', { className: 'section active', dataset: { module: section } });
      main.appendChild(sectionEl);
      mod.renderSection(sectionEl);
    }
  }
}

// Expose globals for modules (avoids circular imports)
window.__dashNavigate = navigate;
window.__dashUnsubscribers = activeUnsubscribers;

// ── Home View ──
function renderHome(container) {
  const section = el('div', { className: 'section active' });

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  section.appendChild(el('h2', {
    className: 'section-title',
    style: { marginBottom: '8px' }
  }, greeting));
  section.appendChild(el('p', {
    style: { color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }
  }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })));

  // Summary grid
  const grid = el('div', { className: 'summary-grid' });
  for (const id of moduleOrder) {
    const mod = modules.get(id);
    if (mod.renderSummary) {
      mod.renderSummary(grid);
    }
  }
  section.appendChild(grid);

  // Make summary cards clickable
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.summary-card');
    if (card && card.dataset.section) {
      navigate(card.dataset.section);
    }
  });

  // Recent activity
  section.appendChild(el('h3', {
    style: { fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '8px' }
  }, 'Recent Activity'));

  const recentList = el('div');
  renderRecentActivity(recentList);
  section.appendChild(recentList);
  container.appendChild(section);

  // Re-render home on any data change (with cleanup)
  // Use a debounce to avoid rapid re-renders
  let homeDebounce = null;
  const unsub = Store.on('*', () => {
    if (currentSection !== 'home') return;
    clearTimeout(homeDebounce);
    homeDebounce = setTimeout(() => {
      if (currentSection === 'home') {
        navigate('home');
      }
    }, 100);
  });
  activeUnsubscribers.push(unsub);
}

function renderRecentActivity(container) {
  const allItems = [];

  for (const [catId] of modules) {
    const items = Store.getCategory(catId);
    for (const item of items.slice(0, 5)) {
      allItems.push({ ...item, _category: catId });
    }
  }

  allItems.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const recent = allItems.slice(0, 8);

  if (recent.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      icon('zap'),
      el('h3', {}, 'Welcome to your dashboard'),
      el('p', {}, 'Start by adding some data or use the dump box (Cmd+K) to quickly log anything')
    ]));
    return;
  }

  const catLabels = { feed: 'Feed', tasks: 'Task', finances: 'Finance', health: 'Health', notes: 'Note', books: 'Book' };
  const catBadges = { feed: 'badge-orange', tasks: 'badge-blue', finances: 'badge-green', health: 'badge-orange', notes: 'badge-purple', books: 'badge-yellow' };

  for (const item of recent) {
    const row = el('div', { className: 'list-item', style: { cursor: 'pointer' } });
    row.addEventListener('click', () => navigate(item._category));

    const badge = el('span', { className: `badge ${catBadges[item._category]}` }, catLabels[item._category]);

    const content = el('div', { className: 'list-item-content' });
    const title = item.title || item.description || item.notes || item.activity || item.type || 'Entry';
    content.appendChild(el('div', { className: 'list-item-title' }, typeof title === 'string' ? title.substring(0, 80) : String(title)));
    content.appendChild(el('div', { className: 'list-item-meta' }, formatDate(item.createdAt)));

    row.appendChild(badge);
    row.appendChild(content);
    container.appendChild(row);
  }
}

// ── Data Management ──
function setupDataButtons() {
  const exportBtn = document.getElementById('btn-export');
  const importBtn = document.getElementById('btn-import');
  const importInput = document.getElementById('import-input');

  exportBtn?.addEventListener('click', () => {
    Store.exportToJSON();
  });

  importBtn?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const hasData = Store.getCategory('tasks').length > 0 ||
                    Store.getCategory('finances').length > 0 ||
                    Store.getCategory('health').length > 0 ||
                    Store.getCategory('notes').length > 0 ||
                    Store.getCategory('books').length > 0;

    let mode = 'replace';
    if (hasData) {
      const choice = confirm('You have existing data.\n\nOK = Replace all data with imported file\nCancel = Merge (keep both, newer wins)');
      mode = choice ? 'replace' : 'merge';
    }

    try {
      await Store.importFromJSON(file, mode);
      navigate(currentSection);
      showToast('Data imported successfully!');
    } catch (err) {
      alert('Error importing data: ' + err.message);
    }

    importInput.value = '';
  });
}

// ── Toast Notifications ──
function showToast(message, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = el('div', {
    className: 'toast',
    style: {
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--accent-green)', color: 'white', padding: '10px 20px',
      borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: '500',
      zIndex: '200', boxShadow: 'var(--shadow-lg)',
      animation: 'fadeIn 0.2s ease'
    }
  }, message);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Mobile Sidebar Toggle ──
function setupMobileMenu() {
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (!menuToggle || !sidebar) return;

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Close sidebar when a nav link is clicked (mobile)
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
    });
  });

  // Close sidebar on overlay click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

// ── Init ──
function init() {
  Store.load();

  // Setup navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.section);
    });
  });

  document.querySelectorAll('.bottom-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      navigate(tab.dataset.section);
    });
  });

  // Setup data buttons
  setupDataButtons();

  // Setup mobile menu
  setupMobileMenu();

  // Init dump box
  initDumpBox();

  // Navigate to home
  navigate('home');
}

// Start
init();
