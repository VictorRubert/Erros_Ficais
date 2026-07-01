const API_URL = "https://restapi-fiscal.onrender.com";

const CATEGORY_TREE = {
  'NFS-e 13':    ['WebService Local', 'WebService Nacional', 'Erros internos'],
  'NF-e 55':     ['Devolução', 'Entrada', 'Normal', 'Erros internos'],
  'NFCom 62':    ['SEFAZ', 'Interno', 'Estaduais'],
  'NFC-e 65':    [],
  'SVA':         [],
  'SPED':        [],
  'DICI':        ['SCM', 'PPP', 'STFC'],
  'Certificado': [],
  'Filial':      [],
  'DRE':         [],
};

// ── Carrega nome do usuário do storage local ───────────────────────────
function loadChromeUserName() {
  const nomeCampo = document.getElementById('f-autor');
  if (!nomeCampo) return;

  chrome.storage.local.get(['userName'], (res) => {
    if (res.userName) {
      nomeCampo.value = res.userName;
      nomeCampo.disabled = true;
      nomeCampo.title = 'Preenchido automaticamente (clique em Editar para mudar)';
      return;
    }

    nomeCampo.value = '';
    nomeCampo.disabled = false;
    nomeCampo.placeholder = 'Seu nome (será salvo)';
    nomeCampo.title = 'Preencha seu nome na primeira vez';
  });
}

function saveUserName() {
  const nomeCampo = document.getElementById('f-autor');
  const nome = nomeCampo.value.trim();
  
  if (nome) {
    chrome.storage.local.set({ userName: nome }, () => {
      nomeCampo.disabled = true;
      nomeCampo.title = 'Preenchido automaticamente (clique em Editar para mudar)';
    });
  }
}

// ── Estado ─────────────────────────────────────────────────────────────
let errors = [];
let currentCategoria   = 'todos';
let currentSubcategoria = '';
let searchTerm = '';
let editingId = null;
let viewingId = null;

function showLoading() {
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('error-list').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  const apiError = document.getElementById('api-error-state');
  if (apiError) apiError.style.display = 'none';
}

function hideLoading() {
  document.getElementById('loading-state').style.display = 'none';
}

function showApiError() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-list').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  const apiError = document.getElementById('api-error-state');
  if (apiError) apiError.style.display = 'block';
}

function showListArea() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-list').style.display = 'block';

  const apiError = document.getElementById('api-error-state');
  if (apiError) apiError.style.display = 'none';
}

// ── Init ───────────────────────────────────────────────────────────────
async function loadErrors() {
  showLoading();

  try {
    const response = await fetch(`${API_URL}/erros`);

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }

    errors = await response.json();

    showListArea();
    renderList();

  } catch (err) {
    console.error('Erro ao carregar erros:', err);

    errors = [];
    showApiError();

  } finally {
    hideLoading();
  }
}

loadErrors();

// ── Helpers ────────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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

  selCat.innerHTML = '<option value="">Selecione...</option>' +
    Object.keys(CATEGORY_TREE).map(cat =>
      `<option value="${cat}"${cat === selectedCat ? ' selected' : ''}>${cat}</option>`
    ).join('');

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

  filtered.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

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
        <span class="ei-badge">${e.categoria || e.tipo || ''}</span>
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
  const e = errors.find(x => String(x.id) === String(id));
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
  loadChromeUserName();
  document.getElementById('form-title').textContent = id ? 'Editar erro' : 'Cadastrar erro';
  document.getElementById('form-error').textContent = '';

  if (id) {
    const e = errors.find(x => String(x.id) === String(id));
    if (e) {
      document.getElementById('f-codigo').value    = e.codigo;
      document.getElementById('f-causa').value     = e.causa;
      document.getElementById('f-resolucao').value = e.resolucao;
      document.getElementById('f-perguntar').value = e.perguntar || '';
      populateFormSelects(e.categoria || e.tipo || '', e.subcategoria || '');
    }
  } else {
    document.getElementById('f-codigo').value    = '';
    document.getElementById('f-causa').value     = '';
    document.getElementById('f-resolucao').value = '';
    document.getElementById('f-perguntar').value = '';
    populateFormSelects();
  }

  setTimeout(() => {
    const nomeCampo = document.getElementById('f-autor');
    if (!nomeCampo.value) {
      nomeCampo.disabled = false;
    }
  }, 100);

  showView('form');
}

async function saveForm() {
  const codigo    = document.getElementById('f-codigo').value.trim();
  const causa     = document.getElementById('f-causa').value.trim();
  const resolucao = document.getElementById('f-resolucao').value.trim();
  const perguntar = document.getElementById('f-perguntar').value.trim();
  const autor     = document.getElementById('f-autor').value.trim();
  const categoria    = document.getElementById('f-categoria').value;
  const subcategoria = document.getElementById('f-subcategoria').value;
  const btnSalvar = document.getElementById('btn-salvar');

  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';

  const err = document.getElementById('form-error');
  if (!codigo) { err.textContent = 'Informe o código ou mensagem de erro.'; return; }
  if (!categoria) { err.textContent = 'Selecione o tipo de documento.'; return; }
  if (!causa) { err.textContent = 'Informe a causa do erro.'; return; }
  if (!resolucao) { err.textContent = 'Informe a resolução.'; return; }

  try {
    const payload = { codigo, categoria, subcategoria, causa, resolucao, perguntar, autor };

    if (editingId) {
      const response = await fetch(`${API_URL}/erros/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } else {
      const response = await fetch(`${API_URL}/erros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }

    saveUserName();
    await loadErrors();
    renderList();
    showView('list');
  } catch (error) {
    console.error('Erro ao salvar:', error);

    err.textContent =
      'Não foi possível salvar o erro. Verifique sua conexão e tente novamente.';
  }
  finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = 'Salvar erro';
  }
}

async function deleteError(id) {
  if (!confirm('Excluir este erro?')) return;

  const btnDelete = document.getElementById('btn-delete');
  btnDelete.disabled = true;
  btnDelete.textContent = 'Excluindo...';

  try {
    const response = await fetch(`${API_URL}/erros/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    await loadErrors();
    renderList();
    showView('list');

  } catch (error) {
    console.error('Erro ao excluir:', error);

    alert('Não foi possível excluir este erro. Verifique sua conexão e tente novamente.');

  } finally {
    btnDelete.disabled = false;
    btnDelete.textContent = 'Excluir';
  }
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

const retryButton = document.getElementById('btn-retry-load');

if (retryButton) {
  retryButton.addEventListener('click', loadErrors);
}

document.getElementById('search').addEventListener('input', e => {
  searchTerm = e.target.value;
  renderList();
});

renderFilters();
showView('list');
