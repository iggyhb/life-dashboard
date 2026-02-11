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

/** Create a small fixed-size icon */
function sIcon(name, size = 16) {
  const i = icon(name);
  i.style.width = size + 'px';
  i.style.height = size + 'px';
  i.style.flexShrink = '0';
  return i;
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

// ── Expandable text block ──

function renderExpandable(text, previewLen = 250, style = {}) {
  if (!text || text.length <= previewLen + 50) {
    // Short enough to show in full
    return el('div', { className: 'card-body', style }, text || '');
  }

  const wrapper = el('div', { className: 'card-body', style });
  const preview = text.substring(0, previewLen).replace(/\s+\S*$/, '') + '...';
  let expanded = false;

  const textEl = el('div', {
    style: { whiteSpace: 'pre-wrap', lineHeight: '1.6' }
  }, preview);

  const toggleBtn = el('button', {
    style: {
      background: 'none', border: 'none', color: 'var(--accent-blue)',
      fontSize: '0.8rem', cursor: 'pointer', padding: '6px 0 0', display: 'flex',
      alignItems: 'center', gap: '4px'
    },
    onClick: () => {
      expanded = !expanded;
      textEl.textContent = expanded ? text : preview;
      toggleBtn.innerHTML = '';
      toggleBtn.appendChild(sIcon(expanded ? 'chevronUp' : 'chevronDown', 14));
      toggleBtn.appendChild(document.createTextNode(expanded ? 'Ver menos' : 'Ver mas'));
    }
  }, [sIcon('chevronDown', 14), 'Ver mas']);

  wrapper.appendChild(textEl);
  wrapper.appendChild(toggleBtn);
  return wrapper;
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
  const dateHeader = el('div', {
    style: { marginBottom: '20px' }
  }, [
    el('div', {
      style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }
    }, [
      sIcon('calendar'),
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

    // Show full reading text with expand/collapse
    if (reading.text) {
      card.appendChild(renderExpandable(reading.text, 300, {
        fontSize: '0.88rem', lineHeight: '1.7', color: 'var(--text-primary)'
      }));
    } else if (reading.summary) {
      card.appendChild(el('div', { className: 'card-body' }, reading.summary));
    }

    container.appendChild(card);
  }

  // ── Patristic Comments ──
  if (liturgy.patristic_comments && liturgy.patristic_comments.length > 0) {
    container.appendChild(el('div', {
      style: { borderTop: '1px solid var(--border)', margin: '24px 0 0' }
    }));

    container.appendChild(el('h3', {
      style: { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '20px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }
    }, [sIcon('book', 18), 'Padres de la Iglesia']));

    // ── Summary overview ──
    const commentsByReading = {};
    for (const c of liturgy.patristic_comments) {
      const key = c.reading_ref || 'General';
      if (!commentsByReading[key]) commentsByReading[key] = [];
      commentsByReading[key].push(c);
    }

    // Build a brief overview of what the Fathers say
    const summaryLines = [];
    for (const [ref, comments] of Object.entries(commentsByReading)) {
      const fatherNames = comments.map(c => {
        const f = c.father || '';
        // Try to extract a recognizable name
        for (const name of ['Origenes', 'Orígenes', 'Crisostomo', 'Crisóstomo', 'Beda', 'Efren', 'Efrén',
          'Agustin', 'Agustín', 'Ambrosio', 'Jeronimo', 'Jerónimo', 'Gregorio', 'Basilio',
          'Cirilo', 'Tertuliano', 'Atanasio', 'Ireneo', 'Clemente', 'Origen', 'Chrysostom',
          'Augustine', 'Ambrose', 'Jerome', 'Gregory', 'Basil', 'Cyril', 'Tertullian']) {
          if (f.toLowerCase().includes(name.toLowerCase())) return name;
        }
        return f.length > 40 ? f.substring(0, 40) + '...' : f;
      });
      summaryLines.push(`${ref}: ${fatherNames.join(', ')}`);
    }

    if (summaryLines.length > 0) {
      const summaryCard = el('div', { className: 'card', style: {
        marginBottom: '16px', background: 'rgba(167, 139, 250, 0.06)', borderLeft: '3px solid var(--accent-purple)'
      }});
      summaryCard.appendChild(el('div', {
        className: 'card-header',
        style: { borderBottom: 'none' }
      }, [
        el('span', { style: { fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-purple)' } }, 'Resumen patristico')
      ]));
      const summaryBody = el('div', { className: 'card-body', style: { fontSize: '0.85rem', color: 'var(--text-secondary)' } });
      for (const line of summaryLines) {
        summaryBody.appendChild(el('div', { style: { marginBottom: '4px' } }, line));
      }
      summaryCard.appendChild(summaryBody);
      container.appendChild(summaryCard);
    }

    // ── Individual patristic comments with expand/collapse ──
    for (const comment of liturgy.patristic_comments) {
      const card = el('div', { className: 'card', style: { marginBottom: '12px', borderLeft: '3px solid var(--accent-purple)' } });

      const header = el('div', { className: 'card-header' });
      header.appendChild(el('span', {
        style: { fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-purple)' }
      }, comment.father || 'Padre de la Iglesia'));

      const metaRight = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
      if (comment.verse_ref) {
        metaRight.appendChild(el('span', {
          style: { fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }
        }, comment.verse_ref));
      }
      metaRight.appendChild(el('span', {
        style: { fontSize: '0.7rem', color: 'var(--text-muted)' }
      }, comment.reading_ref || ''));
      header.appendChild(metaRight);
      card.appendChild(header);

      // Expandable text
      card.appendChild(renderExpandable(comment.text || '', 200, { fontStyle: 'italic' }));

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
      const card = el('div', {
        style: {
          display: 'flex', gap: '12px', padding: '12px',
          borderRadius: '8px', marginBottom: '8px',
          background: 'var(--bg-secondary)', cursor: 'default',
          alignItems: 'flex-start'
        }
      });

      // Thumbnail
      if (item.thumbnail) {
        const thumbEl = el('img', {
          src: item.thumbnail,
          style: {
            width: '64px', height: '64px', borderRadius: '6px',
            objectFit: 'cover', flexShrink: '0',
            background: 'var(--bg-tertiary, #1a1a2e)'
          }
        });
        thumbEl.onerror = function() { this.style.display = 'none'; };
        card.appendChild(thumbEl);
      }

      // Score column
      if (item.score !== undefined) {
        const scoreColor = item.score >= 70 ? 'var(--accent-green)' :
                          item.score >= 40 ? 'var(--accent-yellow)' : 'var(--text-muted)';
        const scoreEl = el('div', {
          style: {
            fontSize: '0.75rem', fontWeight: '700', color: scoreColor,
            minWidth: '28px', textAlign: 'center', paddingTop: '2px', flexShrink: '0'
          }
        }, String(item.score));
        if (!item.thumbnail) card.appendChild(scoreEl);
      }

      const content = el('div', { style: { flex: '1', minWidth: '0' } });

      // Title row (with score badge inline when there's a thumbnail)
      const titleRow = el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } });

      if (item.thumbnail && item.score !== undefined) {
        const scoreColor = item.score >= 70 ? 'var(--accent-green)' :
                          item.score >= 40 ? 'var(--accent-yellow)' : 'var(--text-muted)';
        titleRow.appendChild(el('span', {
          style: { fontSize: '0.7rem', fontWeight: '700', color: scoreColor, flexShrink: '0' }
        }, String(item.score)));
      }

      if (item.url) {
        const link = el('a', {
          href: item.url,
          style: { color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.88rem', fontWeight: '500', lineHeight: '1.3' },
          target: '_blank',
          rel: 'noopener'
        }, item.title || 'Untitled');
        link.addEventListener('mouseenter', () => link.style.color = 'var(--accent-blue)');
        link.addEventListener('mouseleave', () => link.style.color = 'var(--text-primary)');
        titleRow.appendChild(link);
      } else {
        titleRow.appendChild(el('span', { style: { fontSize: '0.88rem', fontWeight: '500' } }, item.title || 'Untitled'));
      }
      content.appendChild(titleRow);

      // Meta: source + comments
      const meta = [];
      if (item.source) meta.push(item.source);
      if (item.reddit_comments) meta.push(`${item.reddit_comments} comments`);
      if (item.why_it_matters) meta.push(item.why_it_matters);
      if (meta.length) {
        content.appendChild(el('div', {
          style: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }
        }, meta.join(' · ')));
      }
      if (item.summary) {
        content.appendChild(el('div', {
          style: { fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }
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
  section.appendChild(el('div', {
    style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }
  }, [
    sIcon(iconName),
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
