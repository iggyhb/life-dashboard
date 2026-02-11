import { el, icon, clear } from '../utils/dom.js';

const FEED_URL = 'data/weekly-feed.json';
const CONFIG_URL = 'data/config.json';

let feedData = null;
let configData = null;
let currentTab = 'liturgy';

async function loadFeed() {
  try {
    const res = await fetch(FEED_URL + '?t=' + Date.now());
    feedData = await res.json();
  } catch {
    feedData = null;
  }
}

async function loadConfig() {
  try {
    const res = await fetch(CONFIG_URL + '?t=' + Date.now());
    configData = await res.json();
  } catch {
    configData = null;
  }
}

function formatFeedDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function renderTabs(container, activeTab, onSwitch) {
  const tabs = el('div', { className: 'tabs' });
  const tabDefs = [
    { id: 'liturgy', label: 'Lecturas', iconName: 'cross' },
    { id: 'news', label: 'Noticias', iconName: 'globe' },
    { id: 'settings', label: 'Config', iconName: 'settings' },
  ];

  for (const t of tabDefs) {
    const btn = el('button', {
      className: `tab ${activeTab === t.id ? 'active' : ''}`,
      onClick: () => onSwitch(t.id)
    }, t.label);
    tabs.appendChild(btn);
  }
  container.appendChild(tabs);
}

// ── Liturgy Tab ──

function renderLiturgyTab(container) {
  const liturgy = feedData?.liturgy;

  if (!liturgy || !liturgy.readings || liturgy.readings.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      icon('cross'),
      el('h3', {}, 'No hay lecturas disponibles'),
      el('p', {}, 'Ejecuta el recolector para obtener las lecturas del dia. Las lecturas se actualizan semanalmente.')
    ]));
    return;
  }

  // Date & Season
  const calIcon = icon('calendar');
  calIcon.style.width = '16px';
  calIcon.style.height = '16px';
  calIcon.style.flexShrink = '0';

  const dateHeader = el('div', {
    style: { marginBottom: '20px' }
  }, [
    el('div', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }
    }, [
      calIcon,
      el('span', {
        style: { fontSize: '0.9rem', fontWeight: '600' }
      }, formatFeedDate(liturgy.date))
    ]),
    el('span', { className: 'badge badge-purple' }, liturgy.season || 'Tiempo Ordinario')
  ]);
  container.appendChild(dateHeader);

  // Readings
  const readingLabels = {
    first_reading: 'Primera Lectura',
    psalm: 'Salmo Responsorial',
    second_reading: 'Segunda Lectura',
    gospel: 'Evangelio'
  };

  const readingColors = {
    first_reading: 'var(--accent-blue)',
    psalm: 'var(--accent-green)',
    second_reading: 'var(--accent-orange)',
    gospel: 'var(--accent-red)'
  };

  for (const reading of liturgy.readings) {
    const color = readingColors[reading.type] || 'var(--accent-blue)';
    const card = el('div', { className: 'card', style: { marginBottom: '12px', borderLeft: `3px solid ${color}` } });

    const header = el('div', { className: 'card-header' });
    header.appendChild(el('span', {
      style: { fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color }
    }, readingLabels[reading.type] || reading.type));
    header.appendChild(el('span', {
      style: { fontSize: '0.8rem', color: 'var(--text-muted)' }
    }, reading.reference));
    card.appendChild(header);

    if (reading.summary) {
      card.appendChild(el('div', { className: 'card-body' }, reading.summary));
    }

    container.appendChild(card);
  }

  // Patristic Comments
  if (liturgy.patristic_comments && liturgy.patristic_comments.length > 0) {
    const bookIcon = icon('book');
    bookIcon.style.width = '18px';
    bookIcon.style.height = '18px';
    bookIcon.style.flexShrink = '0';
    container.appendChild(el('h3', {
      style: { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }
    }, [bookIcon, 'Padres de la Iglesia']));

    for (const comment of liturgy.patristic_comments) {
      const card = el('div', { className: 'card', style: { marginBottom: '12px', borderLeft: '3px solid var(--accent-purple)' } });

      const header = el('div', { className: 'card-header' });
      header.appendChild(el('span', {
        style: { fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-purple)' }
      }, comment.father || 'Padre de la Iglesia'));
      header.appendChild(el('span', {
        style: { fontSize: '0.75rem', color: 'var(--text-muted)' }
      }, comment.reading_ref || ''));
      card.appendChild(header);

      const text = comment.text || '';
      const displayText = text.length > 500 ? text.substring(0, 500) + '...' : text;
      card.appendChild(el('div', {
        className: 'card-body',
        style: { fontStyle: 'italic' }
      }, displayText));

      container.appendChild(card);
    }
  }

  // Meditation
  if (liturgy.meditation && liturgy.meditation !== 'Pending generation...') {
    container.appendChild(el('h3', {
      style: { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '24px 0 12px' }
    }, 'Meditacion'));
    container.appendChild(el('div', {
      className: 'card',
      style: { marginBottom: '12px', background: 'rgba(167, 139, 250, 0.05)', borderColor: 'var(--accent-purple)' }
    }, [
      el('div', { className: 'card-body' }, liturgy.meditation)
    ]));
  }

  // Prayer
  if (liturgy.prayer && liturgy.prayer !== 'Pending generation...') {
    container.appendChild(el('div', {
      className: 'card',
      style: { marginBottom: '12px', background: 'rgba(251, 191, 36, 0.05)', borderColor: 'var(--accent-yellow)' }
    }, [
      el('div', { className: 'card-header' }, [
        el('span', { style: { fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-yellow)' } }, 'Oracion')
      ]),
      el('div', { className: 'card-body', style: { fontStyle: 'italic' } }, liturgy.prayer)
    ]));
  }
}

// ── News Tab ──

function renderNewsTab(container) {
  const sections = feedData?.sections;

  if (!sections || sections.length === 0) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      icon('rss'),
      el('h3', {}, 'No hay noticias disponibles'),
      el('p', {}, 'Ejecuta el recolector para obtener noticias de Reddit y otras fuentes.')
    ]));
    return;
  }

  // Week info
  if (feedData?.generated_at) {
    container.appendChild(el('div', {
      style: { fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }
    }, `Actualizado: ${formatFeedDate(feedData.generated_at)}`));
  }

  for (const section of sections) {
    if (!section.items || section.items.length === 0) continue;

    container.appendChild(el('h3', {
      style: { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '16px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }
    }, section.title));

    for (const item of section.items) {
      const card = el('div', { className: 'list-item', style: { cursor: 'default' } });

      // Score badge
      if (item.score !== undefined) {
        const scoreColor = item.score >= 70 ? 'var(--accent-green)' :
                          item.score >= 40 ? 'var(--accent-yellow)' : 'var(--text-muted)';
        card.appendChild(el('span', {
          style: {
            fontSize: '0.75rem', fontWeight: '700', color: scoreColor,
            minWidth: '32px', textAlign: 'center'
          }
        }, String(item.score)));
      }

      const content = el('div', { className: 'list-item-content' });

      // Title with optional link
      if (item.url) {
        const link = el('a', {
          href: item.url,
          style: { color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' },
          target: '_blank',
          rel: 'noopener'
        }, item.title || 'Untitled');
        link.addEventListener('mouseenter', () => link.style.color = 'var(--accent-blue)');
        link.addEventListener('mouseleave', () => link.style.color = 'var(--text-primary)');
        content.appendChild(link);
      } else {
        content.appendChild(el('div', { className: 'list-item-title' }, item.title || 'Untitled'));
      }

      // Meta: source + why it matters
      const meta = [];
      if (item.source) meta.push(item.source);
      if (item.why_it_matters) meta.push(item.why_it_matters);
      if (meta.length) {
        content.appendChild(el('div', { className: 'list-item-meta' }, meta.join(' · ')));
      }
      if (item.summary) {
        content.appendChild(el('div', {
          style: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }
        }, item.summary));
      }

      card.appendChild(content);
      container.appendChild(card);
    }
  }
}

// ── Settings Tab ──

function renderSettingsTab(container) {
  if (!configData) {
    container.appendChild(el('div', { className: 'empty-state' }, [
      icon('settings'),
      el('h3', {}, 'Config no disponible'),
      el('p', {}, 'No se pudo cargar data/config.json')
    ]));
    return;
  }

  container.appendChild(el('p', {
    style: { fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }
  }, 'Edita data/config.json en tu repo para cambiar estas preferencias. Los cambios se aplicaran en la proxima ejecucion del recolector.'));

  // Topics
  renderConfigSection(container, 'Temas de interes', configData.topics || [], 'globe');

  // Subreddits
  renderConfigSection(container, 'Subreddits', (configData.subreddits || []).map(s => `r/${s}`), 'rss');

  // RSS feeds
  if (configData.rss_feeds && configData.rss_feeds.length > 0) {
    renderConfigSection(container, 'Feeds RSS', configData.rss_feeds, 'rss');
  }

  // Substacks
  if (configData.substacks && configData.substacks.length > 0) {
    renderConfigSection(container, 'Substacks', configData.substacks, 'book');
  }

  // Liturgy settings
  const liturgyCard = el('div', { className: 'card', style: { marginTop: '16px' } });
  liturgyCard.appendChild(el('div', { className: 'card-header' }, [
    el('span', { className: 'card-title' }, 'Lecturas'),
    el('span', { className: `badge ${configData.liturgy?.enabled ? 'badge-green' : 'badge-red'}` },
      configData.liturgy?.enabled ? 'Activo' : 'Desactivado')
  ]));
  const liturgyBody = el('div', { className: 'card-body' });
  liturgyBody.appendChild(el('div', {}, `Padres de la Iglesia: ${configData.liturgy?.include_fathers ? 'Si' : 'No'}`));
  liturgyBody.appendChild(el('div', {}, `Idioma: ${configData.liturgy?.language || 'es'}`));
  liturgyCard.appendChild(liturgyBody);
  container.appendChild(liturgyCard);

  // Schedule info
  container.appendChild(el('div', {
    style: { marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }
  }, `Frecuencia: ${configData.schedule || 'weekly'} · Max items por seccion: ${configData.max_items_per_section || 10}`));
}

function renderConfigSection(container, title, items, iconName) {
  const section = el('div', { style: { marginBottom: '16px' } });
  const sIcon = icon(iconName);
  sIcon.style.width = '16px';
  sIcon.style.height = '16px';
  sIcon.style.flexShrink = '0';
  section.appendChild(el('div', {
    style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }
  }, [
    sIcon,
    el('span', { style: { fontSize: '0.85rem', fontWeight: '600' } }, title)
  ]));

  const tagsWrap = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
  for (const item of items) {
    tagsWrap.appendChild(el('span', { className: 'tag' }, item));
  }
  if (items.length === 0) {
    tagsWrap.appendChild(el('span', {
      style: { fontSize: '0.8rem', color: 'var(--text-muted)' }
    }, 'Ninguno configurado'));
  }
  section.appendChild(tagsWrap);
  container.appendChild(section);
}

// ── Main Module ──

export default {
  id: 'feed',
  label: 'Feed',
  icon: 'rss',
  color: 'var(--accent-orange)',

  async renderSection(container) {
    clear(container);

    // Show loading
    container.appendChild(el('div', {
      style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }
    }, 'Cargando feed...'));

    await Promise.all([loadFeed(), loadConfig()]);

    clear(container);

    const header = el('div', { className: 'section-header' }, [
      el('h2', { className: 'section-title' }, 'Feed Personal'),
    ]);
    container.appendChild(header);

    // Tabs
    const tabContent = el('div');

    const switchTab = (tab) => {
      currentTab = tab;
      clear(container);
      container.appendChild(header);
      renderTabs(container, currentTab, switchTab);
      const newContent = el('div');
      container.appendChild(newContent);

      if (tab === 'liturgy') renderLiturgyTab(newContent);
      else if (tab === 'news') renderNewsTab(newContent);
      else if (tab === 'settings') renderSettingsTab(newContent);
    };

    renderTabs(container, currentTab, switchTab);
    container.appendChild(tabContent);

    if (currentTab === 'liturgy') renderLiturgyTab(tabContent);
    else if (currentTab === 'news') renderNewsTab(tabContent);
    else if (currentTab === 'settings') renderSettingsTab(tabContent);
  },

  renderSummary(container) {
    const card = el('div', { className: 'summary-card', style: { '--card-accent': 'var(--accent-orange)' } });
    card.dataset.section = 'feed';

    const headerEl = el('div', { className: 'summary-card-header' });
    const iconWrap = el('div', { className: 'summary-card-icon', style: { background: 'rgba(251, 146, 60, 0.1)', color: 'var(--accent-orange)' } });
    iconWrap.appendChild(icon('rss'));
    headerEl.appendChild(iconWrap);
    headerEl.appendChild(el('span', { className: 'summary-card-label' }, 'Feed'));
    card.appendChild(headerEl);

    card.appendChild(el('div', { className: 'summary-card-value' }, 'Lecturas & Noticias'));
    card.appendChild(el('div', { className: 'summary-card-detail' }, 'Evangelio del dia, Padres de la Iglesia, Reddit'));

    container.appendChild(card);
  }
};
