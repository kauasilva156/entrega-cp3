/* =========================================
   scripts.js - Kauã Silva Mattoso
   1) Tema claro/escuro (persistido em localStorage)
   2) Formulário: validação, feedback e rascunho automático
   3) Histórico de mensagens enviadas (localStorage)
   4) Gráfico em Canvas
========================================= */

const CHAVE_TEMA = 'kauaTema';
const CHAVE_RASCUNHO = 'kauaRascunhoContato';
const CHAVE_MENSAGENS = 'kauaMensagens';

/* ---------- Utilitários de localStorage (com tratamento de erro) ---------- */
function lerStorage(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch (e) {
    return padrao;
  }
}

function salvarStorage(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (e) {
    return false;
  }
}

function removerStorage(chave) {
  try {
    localStorage.removeItem(chave);
  } catch (e) { /* ignora */ }
}

/* =========================================
   1) TEMA CLARO / ESCURO
========================================= */
function aplicarTema(escuro) {
  document.documentElement.classList.toggle('tema-escuro', escuro);
  const botao = document.getElementById('btn-tema');
  if (botao) {
    botao.textContent = escuro ? '☀️ Tema claro' : '🌙 Tema escuro';
    botao.setAttribute('aria-pressed', String(escuro));
  }
}

function iniciarTema() {
  const header = document.querySelector('header');
  if (!header) return;

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.id = 'btn-tema';
  botao.className = 'btn-tema';
  header.appendChild(botao);

  let escuro = lerStorage(CHAVE_TEMA, null);
  if (escuro === null) {
    escuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  aplicarTema(escuro);

  botao.addEventListener('click', () => {
    const novo = !document.documentElement.classList.contains('tema-escuro');
    aplicarTema(novo);
    salvarStorage(CHAVE_TEMA, novo);
  });
}

/* =========================================
   2) FORMULÁRIO DE CONTATO
========================================= */
function mensagemErro(campo) {
  const v = campo.validity;
  if (v.valueMissing) {
    return campo.type === 'checkbox'
      ? 'Você precisa concordar para continuar.'
      : 'Este campo é obrigatório.';
  }
  if (v.typeMismatch) return 'Informe um e-mail válido (ex.: nome@exemplo.com).';
  if (v.tooShort) return `Digite pelo menos ${campo.minLength} caracteres.`;
  if (v.patternMismatch) return campo.title || 'Formato inválido.';
  if (v.rangeUnderflow || v.rangeOverflow) return `Informe um valor entre ${campo.min} e ${campo.max}.`;
  if (v.badInput) return 'Valor inválido.';
  return 'Valor inválido.';
}

function obterErroEspecifico(campo) {
  // Regra extra: data de nascimento não pode estar no futuro
  if (campo.id === 'nascimento' && campo.value) {
    if (new Date(campo.value) > new Date()) return 'A data não pode estar no futuro.';
  }
  // Nome: não aceitar apenas espaços
  if ((campo.id === 'nome' || campo.id === 'mensagem') && campo.value && !campo.value.trim()) {
    return 'Este campo é obrigatório.';
  }
  return '';
}

function mostrarErro(campo, texto) {
  // Para radios, o erro aparece abaixo do grupo
  const alvo = campo.type === 'radio' ? campo.closest('div:not(.campo-radio)') : campo.parentElement;
  let span = alvo.querySelector(':scope > .erro-campo');
  if (!span) {
    span = document.createElement('span');
    span.className = 'erro-campo';
    span.id = `erro-${campo.id || campo.name}`;
    span.setAttribute('role', 'alert');
    alvo.appendChild(span);
  }
  span.textContent = texto;
  campo.classList.add('campo-invalido');
  campo.setAttribute('aria-invalid', 'true');
  campo.setAttribute('aria-describedby', span.id);
}

function limparErro(campo) {
  const alvo = campo.type === 'radio' ? campo.closest('div:not(.campo-radio)') : campo.parentElement;
  const span = alvo.querySelector(':scope > .erro-campo');
  if (span) span.remove();
  campo.classList.remove('campo-invalido');
  campo.removeAttribute('aria-invalid');
  campo.removeAttribute('aria-describedby');
}

function validarCampo(campo) {
  const erroExtra = obterErroEspecifico(campo);
  if (erroExtra) {
    mostrarErro(campo, erroExtra);
    return false;
  }
  if (campo.type === 'radio') {
    const grupo = campo.form.querySelectorAll(`input[name="${campo.name}"]`);
    const ok = Array.from(grupo).some((r) => r.checked) || !campo.required;
    grupo.forEach((r) => (ok ? limparErro(r) : null));
    if (!ok) mostrarErro(grupo[0], 'Escolha uma opção.');
    return ok;
  }
  if (!campo.checkValidity()) {
    mostrarErro(campo, mensagemErro(campo));
    return false;
  }
  limparErro(campo);
  return true;
}

function mostrarFeedback(texto, tipo) {
  const caixa = document.getElementById('feedback-form');
  caixa.textContent = texto;
  caixa.className = `feedback ${tipo}`;
  caixa.hidden = false;
  caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR');
}

function renderizarHistorico() {
  const lista = document.getElementById('lista-mensagens');
  if (!lista) return;
  const mensagens = lerStorage(CHAVE_MENSAGENS, []);
  lista.innerHTML = '';

  mensagens.slice().reverse().forEach((m) => {
    const li = document.createElement('li');
    const titulo = document.createElement('strong');
    titulo.textContent = `${m.assunto} — ${m.nome}`;
    const meta = document.createElement('small');
    meta.textContent = ` (${formatarDataHora(m.data)}, contato por ${m.preferencia})`;
    const texto = document.createElement('p');
    texto.textContent = m.mensagem;
    texto.style.margin = '0.4rem 0 0 0';
    li.append(titulo, meta, texto);
    lista.appendChild(li);
  });

  document.getElementById('sem-mensagens').hidden = mensagens.length > 0;
  document.getElementById('limpar-historico').hidden = mensagens.length === 0;
}

function iniciarFormulario() {
  const form = document.getElementById('form-contato');
  if (!form) return;

  const campos = Array.from(form.querySelectorAll('input, select, textarea'));
  const nascimento = document.getElementById('nascimento');
  nascimento.max = new Date().toISOString().split('T')[0];

  // Restaurar rascunho salvo
  const rascunho = lerStorage(CHAVE_RASCUNHO, null);
  if (rascunho) {
    campos.forEach((c) => {
      if (!(c.name in rascunho)) return;
      if (c.type === 'radio') c.checked = rascunho[c.name] === c.value;
      else if (c.type === 'checkbox') c.checked = !!rascunho[c.name];
      else c.value = rascunho[c.name];
    });
    mostrarFeedback('Rascunho recuperado: continuamos de onde você parou.', 'sucesso');
  }

  function dadosDoFormulario() {
    const dados = {};
    campos.forEach((c) => {
      if (c.type === 'radio') {
        if (c.checked) dados[c.name] = c.value;
      } else if (c.type === 'checkbox') {
        dados[c.name] = c.checked;
      } else {
        dados[c.name] = c.value;
      }
    });
    return dados;
  }

  // Salvar rascunho enquanto digita
  form.addEventListener('input', () => salvarStorage(CHAVE_RASCUNHO, dadosDoFormulario()));
  form.addEventListener('change', () => salvarStorage(CHAVE_RASCUNHO, dadosDoFormulario()));

  // Validação ao sair do campo e ao corrigir
  campos.forEach((c) => {
    c.addEventListener('blur', () => { if (c.type !== 'radio') validarCampo(c); });
    c.addEventListener('input', () => { if (c.classList.contains('campo-invalido')) validarCampo(c); });
    c.addEventListener('change', () => { if (c.type === 'radio') validarCampo(c); });
  });

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();

    let primeiroInvalido = null;
    campos.forEach((c) => {
      if (!validarCampo(c) && !primeiroInvalido) primeiroInvalido = c;
    });

    if (primeiroInvalido) {
      mostrarFeedback('Corrija os campos destacados e tente novamente.', 'erro');
      primeiroInvalido.focus();
      return;
    }

    const dados = dadosDoFormulario();
    const assuntoTexto = form.assunto.options[form.assunto.selectedIndex].text;
    const mensagens = lerStorage(CHAVE_MENSAGENS, []);
    mensagens.push({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      telefone: dados.telefone,
      assunto: assuntoTexto,
      preferencia: dados.preferencia === 'email' ? 'e-mail' : 'telefone',
      urgencia: dados.urgencia,
      mensagem: dados.mensagem.trim(),
      data: new Date().toISOString()
    });

    if (!salvarStorage(CHAVE_MENSAGENS, mensagens)) {
      mostrarFeedback('Não foi possível salvar a mensagem neste navegador.', 'erro');
      return;
    }

    removerStorage(CHAVE_RASCUNHO);
    form.reset();
    campos.forEach(limparErro);
    renderizarHistorico();
    mostrarFeedback(`Obrigado, ${dados.nome.trim().split(' ')[0]}! Sua mensagem foi enviada e salva com sucesso.`, 'sucesso');
  });

  form.addEventListener('reset', () => {
    removerStorage(CHAVE_RASCUNHO);
    campos.forEach(limparErro);
  });

  const botaoLimpar = document.getElementById('limpar-historico');
  botaoLimpar.addEventListener('click', () => {
    if (confirm('Apagar todas as mensagens salvas neste navegador?')) {
      removerStorage(CHAVE_MENSAGENS);
      renderizarHistorico();
      mostrarFeedback('Histórico apagado.', 'sucesso');
    }
  });

  renderizarHistorico();
}

/* =========================================
   3) GRÁFICO CANVAS (página de gráficos)
========================================= */
function desenharGraficoCanvas() {
  const canvas = document.getElementById('grafico-cursos');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dados = [
    { ano: '2021', valor: 1 },
    { ano: '2022', valor: 2 },
    { ano: '2024', valor: 1 },
    { ano: '2025', valor: 1 }
  ];

  const larguraCanvas = canvas.width;
  const alturaCanvas = canvas.height;
  const margem = 40;
  const larguraBarra = 80;
  const espacoEntreBarras = 40;
  const valorMaximo = 3;
  const escuro = document.documentElement.classList.contains('tema-escuro');

  ctx.clearRect(0, 0, larguraCanvas, alturaCanvas);

  ctx.strokeStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(margem, alturaCanvas - margem);
  ctx.lineTo(larguraCanvas - 20, alturaCanvas - margem);
  ctx.stroke();

  dados.forEach((item, indice) => {
    const alturaBarra = (item.valor / valorMaximo) * (alturaCanvas - margem * 2);
    const x = margem + indice * (larguraBarra + espacoEntreBarras);
    const y = alturaCanvas - margem - alturaBarra;

    ctx.fillStyle = escuro ? '#4d94e0' : '#004080';
    ctx.fillRect(x, y, larguraBarra, alturaBarra);

    ctx.fillStyle = escuro ? '#e6e9ee' : '#2b2b2b';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText(item.ano, x + larguraBarra / 2, alturaCanvas - margem + 20);
    ctx.fillText(item.valor, x + larguraBarra / 2, y - 10);
  });
}

/* =========================================
   INICIALIZAÇÃO
========================================= */
document.addEventListener('DOMContentLoaded', () => {
  iniciarTema();
  iniciarFormulario();
  desenharGraficoCanvas();
  // Redesenha o canvas ao trocar o tema
  const btn = document.getElementById('btn-tema');
  if (btn) btn.addEventListener('click', desenharGraficoCanvas);
});
