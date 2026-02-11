import { CATEGORY_KEYWORDS, PATTERNS } from './utils/keywords.js';
import { Store } from './store.js';
import { el, icon } from './utils/dom.js';
import { today } from './utils/date.js';

// ── Categorization Engine ──

function scoreText(text) {
  const lower = text.toLowerCase().trim();
  const scores = { tasks: 0, finances: 0, health: 0, notes: 0, books: 0 };

  // Keyword scoring
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const word of keywords.strong) {
      if (lower.includes(word)) scores[category] += 3;
    }
    for (const word of keywords.moderate) {
      if (lower.includes(word)) scores[category] += 1;
    }
  }

  // Pattern scoring
  for (const [category, patterns] of Object.entries(PATTERNS)) {
    for (const regex of patterns) {
      if (regex.test(lower)) scores[category] += 4;
    }
  }

  // Structural heuristics
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 8 && /^[a-záéíóú]/i.test(lower)) {
    scores.tasks += 1;
  }
  if (wordCount > 20) {
    scores.notes += 2;
  }

  return scores;
}

function extractFields(text, category) {
  const lower = text.toLowerCase();
  const fields = {};

  if (category === 'finances') {
    const amountMatch = text.match(/(\d+[\.,]?\d*)\s*(?:EUR|USD|€|\$|euros?|dollars?)/i)
      || text.match(/(?:€|\$)\s*(\d+[\.,]?\d*)/i)
      || text.match(/(?:spent|paid|earned|cost|gastado|pagado)\s+(\d+[\.,]?\d*)/i);
    if (amountMatch) {
      fields.amount = parseFloat(amountMatch[1].replace(',', '.'));
    }
    if (/spent|paid|cost|bought|gastado|pagado|compré/i.test(lower)) fields.type = 'expense';
    else if (/earned|received|salary|income|ganado|recibido|salario|ingreso/i.test(lower)) fields.type = 'income';
    else fields.type = 'expense';
    fields.date = today();
  }

  if (category === 'health') {
    const distMatch = text.match(/(\d+[\.,]?\d*)\s*(?:km|mi)/i);
    if (distMatch) fields.distance = parseFloat(distMatch[1].replace(',', '.'));
    const durMatch = text.match(/(\d+)\s*(?:min(?:utes?)?|minutos?)/i);
    if (durMatch) fields.duration = parseInt(durMatch[1]);
    const weightMatch = text.match(/(\d+[\.,]?\d*)\s*(?:kg|lbs?)/i);
    if (weightMatch) fields.value = parseFloat(weightMatch[1].replace(',', '.'));
    const sleepMatch = text.match(/(\d+[\.,]?\d*)\s*(?:hours?|horas?)\s*(?:of\s*)?(?:sleep|sueño|dormir)/i);
    if (sleepMatch) fields.hours = parseFloat(sleepMatch[1].replace(',', '.'));

    // Detect type
    if (fields.hours) fields.type = 'sleep';
    else if (fields.value && /(?:weight|peso|kg|lbs)/i.test(lower)) fields.type = 'weight';
    else if (fields.distance || fields.duration || /(?:ran|run|gym|workout|swim|bike|exercise|corr|ejercicio|gimnasio)/i.test(lower)) fields.type = 'workout';
    else fields.type = 'metric';
    fields.date = today();
  }

  if (category === 'tasks') {
    fields.type = 'task';
    fields.status = 'pending';
    fields.priority = 'medium';
    const dueMatch = text.match(/(?:by|before|due|until|para el|antes del?)\s+(\w+)/i);
    if (dueMatch) fields.dueHint = dueMatch[1];
  }

  if (category === 'notes') {
    fields.pinned = false;
    fields.tags = [];
  }

  if (category === 'books') {
    fields.estado = 'Wishlist';
    fields.tipo = 'Otro';
    if (/(?:reading|leyendo)/i.test(lower)) fields.estado = 'Leyendo';
    else if (/(?:finished|terminé|leí|read\b)/i.test(lower)) fields.estado = 'Leído';
    else if (/(?:want to read|por leer|to read)/i.test(lower)) fields.estado = 'Por leer';
  }

  return fields;
}

export function categorize(text) {
  if (!text || !text.trim()) return null;

  const scores = scoreText(text);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestCategory, bestScore] = sorted[0];
  const [, secondScore] = sorted[1];

  const confidence = bestScore === 0 ? 'none'
    : (bestScore - secondScore >= 3) ? 'high'
    : (bestScore > secondScore) ? 'medium'
    : 'low';

  const finalCategory = bestScore === 0 ? 'notes' : bestCategory;

  return {
    category: finalCategory,
    confidence,
    scores,
    extracted: extractFields(text, finalCategory)
  };
}

// ── Voice Input ──

let recognition = null;
let isRecording = false;

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || 'en-US';
  return rec;
}

export function isSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// ── Dump Box UI ──

const CATEGORY_META = {
  tasks: { label: 'Task', badge: 'badge-blue', icon: 'tasks' },
  finances: { label: 'Finance', badge: 'badge-green', icon: 'finances' },
  health: { label: 'Health', badge: 'badge-orange', icon: 'health' },
  notes: { label: 'Note', badge: 'badge-purple', icon: 'notes' },
  books: { label: 'Book', badge: 'badge-yellow', icon: 'book' },
};

export function initDumpBox() {
  const overlay = document.getElementById('dump-overlay');
  const textarea = document.getElementById('dump-textarea');
  const micBtn = document.getElementById('dump-mic');
  const prediction = document.getElementById('dump-prediction');
  const preview = document.getElementById('dump-preview');
  const saveBtn = document.getElementById('dump-save');
  const cancelBtn = document.getElementById('dump-cancel');
  const closeBtn = document.getElementById('dump-close');
  const categorySelect = document.getElementById('dump-category-select');
  const previewFields = document.getElementById('dump-preview-fields');
  const fab = document.getElementById('dump-fab');

  let currentResult = null;

  // Hide mic if not available
  if (!isSpeechAvailable()) {
    micBtn.style.display = 'none';
  }

  // Open/close
  function open() {
    overlay.classList.add('open');
    textarea.value = '';
    finalTranscript = '';
    prediction.innerHTML = '';
    preview.classList.remove('visible', 'high-confidence', 'low-confidence');
    currentResult = null;
    setTimeout(() => textarea.focus(), 100);
  }

  function close() {
    overlay.classList.remove('open');
    stopRecording();
    textarea.value = '';
    finalTranscript = '';
    currentResult = null;
  }

  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('open')) {
        close();
      } else {
        open();
      }
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      close();
    }
  });

  // Live prediction on typing
  let debounceTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePrediction(textarea.value);
    }, 300);
  });

  function updatePrediction(text) {
    if (!text.trim()) {
      prediction.innerHTML = '';
      preview.classList.remove('visible');
      currentResult = null;
      return;
    }

    currentResult = categorize(text);
    if (!currentResult) return;

    const meta = CATEGORY_META[currentResult.category];
    prediction.innerHTML = '';
    prediction.appendChild(
      el('span', { className: `badge ${meta.badge}` }, meta.label)
    );
    prediction.appendChild(
      el('span', { className: 'dump-prediction-text' },
        currentResult.confidence === 'high' ? 'Confident match' :
        currentResult.confidence === 'medium' ? 'Likely match' :
        'Best guess — you can change it')
    );

    // Show preview
    showPreview(currentResult, text);
  }

  function showPreview(result, text) {
    preview.classList.add('visible');
    preview.classList.remove('high-confidence', 'low-confidence');
    if (result.confidence === 'high') {
      preview.classList.add('high-confidence');
    } else if (result.confidence === 'low' || result.confidence === 'none') {
      preview.classList.add('low-confidence');
    }

    categorySelect.value = result.category;

    // Show extracted fields
    previewFields.innerHTML = '';
    const fields = result.extracted;
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'type' || key === 'status' || key === 'priority' || key === 'pinned' || key === 'tags' || key === 'date') {
        previewFields.appendChild(
          el('span', { className: 'dump-preview-field' }, [
            el('span', {}, `${key}: `),
            el('strong', {}, String(val))
          ])
        );
      } else if (typeof val === 'number') {
        previewFields.appendChild(
          el('span', { className: 'dump-preview-field' }, [
            el('span', {}, `${key}: `),
            el('strong', {}, String(val))
          ])
        );
      }
    }
  }

  // Category override
  categorySelect.addEventListener('change', () => {
    if (currentResult) {
      currentResult.category = categorySelect.value;
      currentResult.extracted = extractFields(textarea.value, categorySelect.value);
      const meta = CATEGORY_META[currentResult.category];
      prediction.innerHTML = '';
      prediction.appendChild(
        el('span', { className: `badge ${meta.badge}` }, meta.label)
      );
      prediction.appendChild(
        el('span', { className: 'dump-prediction-text' }, 'Manually selected')
      );
      showPreview(currentResult, textarea.value);
    }
  });

  // Save
  saveBtn.addEventListener('click', () => {
    if (!currentResult || !textarea.value.trim()) return;
    saveDumpItem(textarea.value.trim(), currentResult);
    close();
  });

  // Also save on Ctrl+Enter
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (currentResult && textarea.value.trim()) {
        saveDumpItem(textarea.value.trim(), currentResult);
        close();
      }
    }
  });

  // ── Voice ──
  let finalTranscript = '';

  function launchRecognition() {
    // Always create a fresh instance for each start
    recognition = createRecognition();
    if (!recognition) return;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
          textarea.value = finalTranscript;
          updatePrediction(finalTranscript);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        textarea.value = finalTranscript + (finalTranscript ? ' ' : '') + interim;
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      // Don't stop on 'no-speech' or 'aborted' — just let it restart
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopRecording();
      }
      // For 'no-speech', 'network', 'audio-capture', etc. — onend will fire
      // and we auto-restart there
    };

    recognition.onend = () => {
      // Auto-restart with a fresh instance if user hasn't stopped
      if (isRecording) {
        setTimeout(() => {
          if (isRecording) {
            launchRecognition();
          }
        }, 100);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech start failed:', e);
      // Retry after a brief pause
      if (isRecording) {
        setTimeout(() => {
          if (isRecording) launchRecognition();
        }, 300);
      }
    }
  }

  function startRecording() {
    if (isRecording) { stopRecording(); return; }

    isRecording = true;
    finalTranscript = textarea.value; // preserve existing text
    micBtn.classList.add('recording');
    launchRecognition();
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.abort(); } catch {}
      recognition = null;
    }
    // Run final prediction on whatever we got
    if (textarea.value.trim()) {
      updatePrediction(textarea.value);
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

function saveDumpItem(rawText, result) {
  const { category, extracted } = result;
  let item;

  switch (category) {
    case 'tasks':
      item = {
        type: extracted.type || 'task',
        title: rawText.length > 100 ? rawText.substring(0, 100) : rawText,
        description: rawText.length > 100 ? rawText : '',
        status: 'pending',
        priority: extracted.priority || 'medium',
        dueDate: null,
        tags: [],
        frequency: null,
        completions: [],
        source: 'dumpbox',
        rawInput: rawText
      };
      break;

    case 'finances':
      item = {
        type: extracted.type || 'expense',
        amount: extracted.amount || 0,
        currency: 'EUR',
        category: 'other',
        description: rawText,
        date: extracted.date || new Date().toISOString().split('T')[0],
        recurring: false,
        source: 'dumpbox',
        rawInput: rawText
      };
      break;

    case 'health':
      item = {
        type: extracted.type || 'metric',
        activity: extracted.activity || 'other',
        duration: extracted.duration || null,
        distance: extracted.distance || null,
        value: extracted.value || null,
        unit: extracted.value ? 'kg' : null,
        hours: extracted.hours || null,
        quality: null,
        notes: rawText,
        date: extracted.date || new Date().toISOString().split('T')[0],
        source: 'dumpbox',
        rawInput: rawText
      };
      break;

    case 'books':
      item = {
        title: rawText.split('\n')[0].substring(0, 100),
        autor: [],
        estado: extracted.estado || 'Wishlist',
        tipo: extracted.tipo || 'Otro',
        calificacion: '',
        tags: [],
        source: 'dumpbox',
        rawInput: rawText
      };
      break;

    case 'notes':
    default:
      item = {
        title: rawText.split('\n')[0].substring(0, 100),
        body: rawText,
        tags: [],
        pinned: false,
        source: 'dumpbox',
        rawInput: rawText
      };
      break;
  }

  Store.addItem(category, item);

  // Log to dumpbox history
  Store.addItem('dumpbox_history', {
    rawInput: rawText,
    category,
    confidence: result.confidence,
    timestamp: new Date().toISOString()
  });
}
