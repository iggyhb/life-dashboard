export const CATEGORY_KEYWORDS = {
  tasks: {
    strong: ['todo', 'task', 'remind', 'reminder', 'deadline', 'due', 'habit',
             'daily', 'weekly', 'checklist', 'to-do', 'to do'],
    moderate: ['buy', 'call', 'email', 'send', 'finish', 'complete',
               'schedule', 'appointment', 'meeting', 'pick up', 'pickup',
               'do', 'make', 'fix', 'clean', 'organize', 'book', 'cancel',
               'renew', 'return', 'submit', 'prepare', 'plan',
               // Spanish
               'comprar', 'llamar', 'enviar', 'terminar', 'completar',
               'cita', 'reunion', 'recoger', 'hacer', 'limpiar',
               'organizar', 'reservar', 'cancelar', 'renovar', 'devolver',
               'tarea', 'recordar', 'recordatorio']
  },
  finances: {
    strong: ['paid', 'spent', 'earned', 'cost', 'price', 'budget',
             'invoice', 'salary', 'rent', 'subscription', 'expense',
             'income', 'receipt', 'refund',
             // Spanish
             'pagado', 'gastado', 'ganado', 'costo', 'precio', 'presupuesto',
             'factura', 'salario', 'alquiler', 'suscripcion', 'gasto',
             'ingreso', 'recibo', 'reembolso'],
    moderate: ['euro', 'euros', 'dollar', 'dollars', 'money', 'cheap', 'expensive',
               'bill', 'payment', 'transfer', 'bank', 'save', 'saving',
               'credit', 'debit', 'tax', 'tip', 'fee',
               // Spanish
               'dinero', 'barato', 'caro', 'cuenta', 'pago', 'transferencia',
               'banco', 'ahorrar', 'ahorro', 'credito', 'debito', 'impuesto']
  },
  health: {
    strong: ['workout', 'exercise', 'ran', 'gym', 'weight', 'sleep',
             'calories', 'diet', 'yoga', 'run', 'swim', 'bike', 'cycling',
             'reps', 'sets', 'protein', 'cardio', 'training',
             // Spanish
             'ejercicio', 'corri', 'gimnasio', 'peso', 'dormir',
             'calorias', 'dieta', 'correr', 'nadar', 'bicicleta',
             'entrenamiento', 'repeticiones', 'series'],
    moderate: ['walked', 'walk', 'steps', 'tired', 'energy', 'headache',
               'medicine', 'doctor', 'water', 'meal', 'ate', 'breakfast',
               'lunch', 'dinner', 'slept', 'hours of sleep', 'kg', 'lbs',
               'pushups', 'squats', 'plank', 'stretch', 'rest',
               // Spanish
               'caminar', 'camine', 'pasos', 'cansado', 'energia',
               'dolor', 'medicina', 'medico', 'agua', 'comida',
               'desayuno', 'almuerzo', 'cena', 'dormi']
  },
  notes: {
    strong: ['idea', 'thought', 'note', 'concept', 'inspiration',
             'brainstorm', 'journal', 'reflection',
             // Spanish
             'idea', 'pensamiento', 'nota', 'concepto', 'inspiracion',
             'reflexion', 'diario'],
    moderate: ['maybe', 'what if', 'interesting', 'read about',
               'look into', 'research', 'think about', 'wonder',
               'remember', 'curious', 'link', 'article',
               // Spanish
               'quizas', 'interesante', 'investigar', 'pensar',
               'curioso', 'articulo']
  },
  books: {
    strong: ['book', 'reading', 'read', 'author', 'novel', 'libro',
             'leyendo', 'leer', 'autor', 'novela', 'kindle', 'audible', 'ebook'],
    moderate: ['chapter', 'page', 'pages', 'genre', 'fiction', 'non-fiction',
               'nonfiction', 'biography', 'memoir', 'recommended', 'recommendation',
               'library', 'bookshelf',
               // Spanish
               'capítulo', 'página', 'páginas', 'género', 'ficción',
               'biografía', 'biblioteca', 'estantería', 'recomendación',
               'espiritual', 'autoayuda']
  }
};

export const PATTERNS = {
  finances: [
    /\d+[\.,]\d{2}\s*(?:EUR|USD|€|\$)/i,
    /(?:€|\$)\s*\d+[\.,]?\d*/i,
    /(?:spent|paid|earned|cost|gastado|pagado|ganado)\s+\d+/i,
    /\d+\s*(?:euros?|dollars?|bucks)/i,
  ],
  health: [
    /\d+\s*(?:km|mi|miles?|reps?|sets?|min(?:utes?)?|kg|lbs?|cal)/i,
    /(?:ran|walked|cycled|swam|corri|camine)\s+\d+/i,
    /\d+\s*hours?\s*(?:of\s*)?sleep/i,
    /\d+\s*horas?\s*(?:de\s*)?(?:sueño|dormir)/i,
    /(?:push.?ups?|pull.?ups?|squats?|planks?|sentadillas)\s*:?\s*\d+/i,
  ],
  tasks: [
    /^(?:buy|call|email|send|fix|clean|finish|do|get|pick up|comprar|llamar|enviar|hacer|limpiar|terminar)\s/i,
    /(?:by|before|due|until|para el|antes del?)\s+\w+/i,
    /(?:need to|have to|must|should|tengo que|debo|necesito)\s/i,
  ],
  books: [
    /(?:reading|read|finished|started|leyendo|leí|terminé|empecé)\s+["'"']?[A-Z]/,
    /(?:book|libro|novel|novela)\s+(?:by|de|por)\s/i,
    /(?:by|de)\s+[A-Z][a-z]+\s+[A-Z]/,
  ]
};
