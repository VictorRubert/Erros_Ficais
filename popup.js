const CATEGORY_TREE = {
  'NFS-e 13':    ['WebService Local', 'WebService Nacional', 'Erros internos'],
  'NF-e 55':     ['Devolução', 'Entrada', 'Normal', 'Erros internos'],
  'NFCom 62':    ['SEFAZ', 'Interno', 'Estaduais'],
  'NFC-e 65':    [],
  'SVA/VD':      [],
  'SPED':        [],
  'DICI':        ['SCM', 'PPP', 'STFC'],
  'Certificado': [],
  'Filial':      [],
  'DRE':         [],
};

// ── Dados iniciais (exemplos reais) ───────────────────────────────────
const INITIAL_ERRORS = [];

// ── Estado ─────────────────────────────────────────────────────────────
let errors = [];
let currentCategoria   = 'todos';
let currentSubcategoria = '';
let searchTerm = '';
let editingId = null;
let viewingId = null;

// ── Init ───────────────────────────────────────────────────────────────
chrome.storage.local.get(['fiscal_errors', 'initialized'], (res) => {
  if (!res.initialized) {
    chrome.storage.local.set({ fiscal_errors: INITIAL_ERRORS, initialized: true }, () => {
      errors = INITIAL_ERRORS;
      renderList();
    });
  } else {
    errors = res.fiscal_errors || [];
    renderList();
  }
});

// ── Helpers ────────────────────────────────────────────────────────────
function save() {
  chrome.storage.local.set({ fiscal_errors: errors });
}

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showView(name) {
  document.getElementById('view-list').style.display    = name === 'list'   ? 'flex'  : 'none';
  document.getElementById('view-detail').style.display  = name === 'detail' ? 'block' : 'none';
  document.getElementById('view-form').style.display    = name === 'form'   ? 'block' : 'none';
  document.getElementById('search-wrap').style.display  = name === 'list'   ? 'block' : 'none';
  document.getElementById('btn-novo').style.display     = name === 'list'   ? 'block' : 'none';
  if (name !== 'list') {
    document.getElementById('subfilter-bar').style.display = 'none';
  }
}

// ── Renderiza filtros dinamicamente ───────────────────────────────────
function renderFilters() {
  const bar    = document.getElementById('filter-bar');
  const subbar = document.getElementById('subfilter-bar');

  // Categorias principais
  const cats = ['todos', ...Object.keys(CATEGORY_TREE)];
  bar.innerHTML = cats.map(cat => `
    <button class="filter-chip${cat === currentCategoria ? ' active' : ''}"
            data-cat="${cat}">
      ${cat === 'todos' ? 'Todos' : cat}
    </button>
  `).join('');

  bar.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategoria    = btn.dataset.cat;
      currentSubcategoria = '';
      renderFilters();
      renderList();
    });
  });

  // Subcategorias
  const subs = currentCategoria !== 'todos'
    ? (CATEGORY_TREE[currentCategoria] || [])
    : [];

  if (subs.length > 0) {
    subbar.style.display = 'flex';
    subbar.innerHTML = [
      `<button class="filter-chip${currentSubcategoria === '' ? ' active' : ''}" data-sub="">Todos</button>`,
      ...subs.map(s => `
        <button class="filter-chip${currentSubcategoria === s ? ' active' : ''}" data-sub="${s}">${s}</button>
      `)
    ].join('');

    subbar.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSubcategoria = btn.dataset.sub;
        renderFilters();
        renderList();
      });
    });
  } else {
    subbar.style.display = 'none';
    subbar.innerHTML = '';
  }
}

// ── Popula selects do formulário ──────────────────────────────────────
function populateFormSelects(selectedCat = '', selectedSub = '') {
  const selCat = document.getElementById('f-categoria');
  const selSub = document.getElementById('f-subcategoria');
  const lblSub = document.getElementById('label-subcategoria');

  // Categoria
  selCat.innerHTML = '<option value="">Selecione...</option>' +
    Object.keys(CATEGORY_TREE).map(cat =>
      `<option value="${cat}"${cat === selectedCat ? ' selected' : ''}>${cat}</option>`
    ).join('');

  // Subcategoria
  const updateSub = (cat) => {
    const subs = CATEGORY_TREE[cat] || [];
    if (subs.length > 0) {
      selSub.innerHTML = '<option value="">Selecione...</option>' +
        subs.map(s => `<option value="${s}"${s === selectedSub ? ' selected' : ''}>${s}</option>`).join('');
      selSub.style.display = 'block';
      lblSub.style.display = 'block';
    } else {
      selSub.innerHTML = '';
      selSub.style.display = 'none';
      lblSub.style.display = 'none';
    }
  };

  updateSub(selectedCat);
  selCat.addEventListener('change', () => updateSub(selCat.value));
}

// ── Render list ────────────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById('error-list');
  const empty = document.getElementById('empty-state');

  let filtered = errors.filter(e => {
  const cat = e.categoria || e.tipo || '';
  const sub = e.subcategoria || '';
  const matchCat = currentCategoria === 'todos' || cat === currentCategoria;
  const matchSub = !currentSubcategoria || sub === currentSubcategoria;
  const q = searchTerm.toLowerCase();
  const matchSearch = !q ||
    (e.codigo     || '').toLowerCase().includes(q) ||
    (e.causa      || '').toLowerCase().includes(q) ||
    (cat          || '').toLowerCase().includes(q) ||
    (e.resolucao  || '').toLowerCase().includes(q);
  return matchCat && matchSub && matchSearch;
  });

  filtered.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = filtered.map(e => `
    <div class="error-item" data-id="${e.id}">
      <div class="ei-header">
        <span class="ei-code">${e.codigo}</span>
        <span class="ei-badge">${e.tipo}</span>
      </div>
      <div class="ei-causa">${e.causa}</div>
      <div class="ei-meta">${e.autor ? e.autor + ' · ' : ''}${fmt(e.data)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.error-item').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

// ── Detail ─────────────────────────────────────────────────────────────
function openDetail(id) {
  const e = errors.find(x => x.id === id);
  if (!e) return;
  viewingId = id;

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-code">${e.codigo}</div>
    <span class="detail-badge">${e.categoria || e.tipo || ''}${e.subcategoria ? ' › ' + e.subcategoria : ''}</span>
    <div class="detail-section">
      <div class="detail-section-label">Causa</div>
      <div class="detail-section-body">${e.causa}</div>
    </div>
    <div class="detail-section">
      <div class="detail-section-label">Resolução no IXC</div>
      <div class="detail-section-body resolucao">${e.resolucao}</div>
    </div>
    ${e.perguntar ? `
    <div class="detail-section">
      <div class="detail-section-label">O que perguntar ao cliente</div>
      <div class="detail-section-body">${e.perguntar}</div>
    </div>` : ''}
    <div class="detail-meta">Registrado por ${e.autor || 'Desconhecido'} em ${fmt(e.data)}</div>
  `;

  showView('detail');
}

// ── Form ───────────────────────────────────────────────────────────────
function openForm(id = null) {
  editingId = id;
  document.getElementById('form-title').textContent = id ? 'Editar erro' : 'Cadastrar erro';
  document.getElementById('form-error').textContent = '';

  document.querySelectorAll('.fchip').forEach(b => b.classList.remove('on'));

  if (id) {
    const e = errors.find(x => x.id === id);
    document.getElementById('f-codigo').value    = e.codigo;
    document.getElementById('f-causa').value     = e.causa;
    document.getElementById('f-resolucao').value = e.resolucao;
    document.getElementById('f-perguntar').value = e.perguntar || '';
    document.getElementById('f-autor').value     = e.autor || '';
    populateFormSelects(e.categoria || e.tipo || '', e.subcategoria || '');
  } else {
    document.getElementById('f-codigo').value    = '';
    document.getElementById('f-causa').value     = '';
    document.getElementById('f-resolucao').value = '';
    document.getElementById('f-perguntar').value = '';
    document.getElementById('f-autor').value     = '';
    populateFormSelects();
  }

  showView('form');
}

function saveForm() {
  const codigo    = document.getElementById('f-codigo').value.trim();
  const causa     = document.getElementById('f-causa').value.trim();
  const resolucao = document.getElementById('f-resolucao').value.trim();
  const perguntar = document.getElementById('f-perguntar').value.trim();
  const autor     = document.getElementById('f-autor').value.trim();
  const categoria    = document.getElementById('f-categoria').value;
  const subcategoria = document.getElementById('f-subcategoria').value;

  const err = document.getElementById('form-error');
  if (!codigo) { err.textContent = 'Informe o código ou mensagem de erro.'; return; }
  if (!categoria)   { err.textContent = 'Selecione o tipo de documento.'; return; }
  if (!causa)  { err.textContent = 'Informe a causa do erro.'; return; }
  if (!resolucao) { err.textContent = 'Informe a resolução.'; return; }

  if (editingId) {
    const idx = errors.findIndex(x => x.id === editingId);
    errors[idx] = { ...errors[idx], codigo, tipo, causa, resolucao, perguntar, autor };
    save();
    openDetail(editingId);
  } else {
    const novo = {
      id: 'e' + Date.now(),
      codigo, categoria, subcategoria, causa, resolucao, perguntar, autor,
      data: new Date().toISOString(),
    };
    errors.unshift(novo);
    save();
    renderList();
    showView('list');
  }
}

function deleteError(id) {
  if (!confirm('Excluir este erro?')) return;
  errors = errors.filter(x => x.id !== id);
  save();
  renderList();
  showView('list');
}

// ── Events ─────────────────────────────────────────────────────────────
document.getElementById('btn-novo').addEventListener('click', () => openForm());
document.getElementById('btn-back').addEventListener('click', () => { renderList(); showView('list'); });
document.getElementById('btn-edit').addEventListener('click', () => openForm(viewingId));
document.getElementById('btn-delete').addEventListener('click', () => deleteError(viewingId));
document.getElementById('btn-salvar').addEventListener('click', saveForm);
document.getElementById('btn-cancelar').addEventListener('click', () => {
  if (editingId) { openDetail(editingId); }
  else { renderList(); showView('list'); }
});

document.getElementById('search').addEventListener('input', e => {
  searchTerm = e.target.value;
  renderList();
});

renderFilters();
showView('list');
