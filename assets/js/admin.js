// Painel do administrador: cursos, aulas, relatório de cursistas e usuários.
// Navegação pelo endereço: #cursos, #novo, #curso=ID, #relatorio=ID, #usuarios.

import {
  supabase, configurado, exigirLogin, montarPagina, avisoNaoConfigurado,
  esc, linkIncorporado, formatarHoras, formatarCarga, formatarData, mensagemErro, mostrarMensagem,
} from "./app.js";

const main = document.getElementById("conteudo");
let perfil;

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  perfil = await exigirLogin();
  montarPagina(perfil, "admin");

  if (!perfil.admin) {
    main.innerHTML = `<section class="container secao"><div class="aviso aviso-erro">
      Esta área é restrita aos administradores.</div></section>`;
    return;
  }

  window.addEventListener("hashchange", rotear);
  rotear();
}

function rotear() {
  const [rota, id] = location.hash.slice(1).split("=");
  const telas = {
    novo: () => telaCurso(null),
    curso: () => telaCurso(id),
    relatorio: () => telaRelatorio(id),
    usuarios: telaUsuarios,
  };
  const abrir = telas[rota] ?? telaCursos;

  main.innerHTML = `
    <section class="container secao">
      <h1>Administração</h1>
      <div class="abas" role="tablist">
        <a class="aba" href="#cursos" aria-selected="${rota !== "usuarios"}">Cursos</a>
        <a class="aba" href="#usuarios" aria-selected="${rota === "usuarios"}">Usuários</a>
      </div>
      <div id="tela"><p class="carregando">Carregando…</p></div>
    </section>`;

  abrir().catch((erro) => {
    document.getElementById("tela").innerHTML =
      `<div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div>`;
  });
}

const tela = () => document.getElementById("tela");

// --------------------------------------------------------------------------
// Lista de cursos
// --------------------------------------------------------------------------

async function telaCursos() {
  const { data, error } = await supabase
    .from("cursos")
    .select("id, titulo, carga_horaria, publicado, aulas(count)")
    .order("criado_em", { ascending: false });
  if (error) throw error;

  tela().innerHTML = `
    <div class="cartao">
      <div class="acoes" style="justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0">Cursos</h2>
        <a class="botao botao-escuro" href="#novo">+ Novo curso</a>
      </div>
      ${data.length === 0
        ? `<p class="texto-suave">Nenhum curso cadastrado. Clique em “Novo curso” para começar.</p>`
        : `<div class="tabela-rolagem"><table>
            <thead><tr><th>Curso</th><th>Situação</th><th>Aulas</th><th>Carga</th><th></th></tr></thead>
            <tbody>${data.map((c) => `
              <tr>
                <td><strong>${esc(c.titulo)}</strong></td>
                <td>${c.publicado
                  ? `<span class="etiqueta etiqueta-sucesso">Publicado</span>`
                  : `<span class="etiqueta etiqueta-rascunho">Rascunho</span>`}</td>
                <td>${c.aulas[0]?.count ?? 0}</td>
                <td>${formatarCarga(c.carga_horaria)}</td>
                <td><div class="acoes">
                  <a class="botao botao-pequeno" href="#curso=${c.id}">Editar</a>
                  <a class="botao botao-pequeno botao-claro" href="#relatorio=${c.id}">Relatório</a>
                  <a class="botao botao-pequeno botao-claro" href="curso.html?id=${c.id}">Ver</a>
                </div></td>
              </tr>`).join("")}</tbody>
          </table></div>`}
    </div>`;
}

// --------------------------------------------------------------------------
// Criar / editar curso e suas aulas
// --------------------------------------------------------------------------

async function telaCurso(id) {
  let curso = { titulo: "", descricao: "", carga_horaria: 30, capa_url: "", publicado: false };
  if (id) {
    const { data, error } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Curso não encontrado.");
    curso = data;
  }

  tela().innerHTML = `
    <p><a href="#cursos">← Voltar aos cursos</a></p>
    <div class="admin-grade">
      <div class="cartao">
        <h2>${id ? "Dados do curso" : "Novo curso"}</h2>
        <div id="msg-curso"></div>
        <form class="formulario" id="form-curso">
          <div class="campo"><label for="titulo">Título</label>
            <input id="titulo" name="titulo" required value="${esc(curso.titulo)}"></div>
          <div class="campo"><label for="descricao">Descrição</label>
            <textarea id="descricao" name="descricao">${esc(curso.descricao)}</textarea></div>
          <div class="linha-campos">
            <div class="campo"><label for="carga">Carga horária (horas)</label>
              <input id="carga" name="carga_horaria" type="number" min="0" step="0.5" required value="${esc(curso.carga_horaria)}"></div>
            <div class="campo"><label for="capa">Imagem de capa (link, opcional)</label>
              <input id="capa" name="capa_url" type="url" value="${esc(curso.capa_url ?? "")}"></div>
          </div>
          <label class="campo-check"><input type="checkbox" name="publicado" ${curso.publicado ? "checked" : ""}>
            Publicado (visível para os cursistas)</label>
          <div class="acoes">
            <button class="botao botao-escuro" type="submit">${id ? "Salvar alterações" : "Criar curso"}</button>
            ${id ? `<button class="botao botao-perigo" type="button" id="excluir-curso">Excluir curso</button>` : ""}
          </div>
        </form>
      </div>
      <div class="cartao" id="painel-aulas">
        ${id ? `<p class="carregando">Carregando aulas…</p>`
             : `<h2>Aulas</h2><p class="texto-suave">Crie o curso primeiro; depois adicione as aulas aqui.</p>`}
      </div>
    </div>`;

  const form = document.getElementById("form-curso");
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = {
      titulo: form.titulo.value.trim(),
      descricao: form.descricao.value.trim(),
      carga_horaria: Number(form.carga_horaria.value),
      capa_url: form.capa_url.value.trim() || null,
      publicado: form.publicado.checked,
    };
    const resposta = id
      ? await supabase.from("cursos").update(dados).eq("id", id).select("id").single()
      : await supabase.from("cursos").insert(dados).select("id").single();
    const msg = document.getElementById("msg-curso");
    if (resposta.error) return mostrarMensagem(msg, mensagemErro(resposta.error));
    if (!id) {
      location.hash = `curso=${resposta.data.id}`;
    } else {
      mostrarMensagem(msg, "Curso salvo.", "sucesso");
    }
  });

  document.getElementById("excluir-curso")?.addEventListener("click", async () => {
    if (!confirm(`Excluir o curso “${curso.titulo}”? As aulas, o progresso dos cursistas e os certificados deste curso também serão apagados.`)) return;
    const { error } = await supabase.from("cursos").delete().eq("id", id);
    if (error) return mostrarMensagem(document.getElementById("msg-curso"), mensagemErro(error));
    location.hash = "cursos";
  });

  if (id) await painelAulas(id);
}

async function painelAulas(cursoId, editando = null) {
  const { data: aulas, error } = await supabase
    .from("aulas")
    .select("id, titulo, descricao, video_url, duracao_minutos, ordem")
    .eq("curso_id", cursoId)
    .order("ordem").order("criado_em");
  if (error) throw error;

  const aula = aulas.find((a) => a.id === editando) ??
    { titulo: "", descricao: "", video_url: "", duracao_minutos: "" };
  const totalMin = aulas.reduce((s, a) => s + a.duracao_minutos, 0);
  const painel = document.getElementById("painel-aulas");

  painel.innerHTML = `
    <h2>Aulas (${aulas.length})</h2>
    ${totalMin ? `<p class="texto-suave">Duração total dos vídeos: ${formatarHoras(totalMin)}</p>` : ""}
    ${aulas.length ? `<ol class="lista-aulas" style="margin-bottom:20px">${aulas.map((a, i) => `
      <li><div class="cartao" style="padding:10px 12px;box-shadow:none;display:flex;gap:8px;align-items:center;justify-content:space-between">
        <span>${i + 1}. ${esc(a.titulo)}
          ${a.duracao_minutos ? `<small class="texto-suave">· ${formatarHoras(a.duracao_minutos)}</small>` : ""}
          ${linkIncorporado(a.video_url) ? "" : `<small style="color:var(--alerta)">· link inválido</small>`}</span>
        <span class="acoes" style="flex-wrap:nowrap;gap:4px">
          <button class="botao botao-pequeno botao-claro" data-acao="subir" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
          <button class="botao botao-pequeno botao-claro" data-acao="descer" data-i="${i}" ${i === aulas.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
          <button class="botao botao-pequeno" data-acao="editar" data-i="${i}">Editar</button>
          <button class="botao botao-pequeno botao-perigo" data-acao="excluir" data-i="${i}">Excluir</button>
        </span>
      </div></li>`).join("")}</ol>` : ""}

    <h3 id="titulo-form-aula">${editando ? "Editar aula" : "Adicionar aula"}</h3>
    <div id="msg-aula"></div>
    <form class="formulario" id="form-aula">
      <div class="campo"><label for="a-titulo">Título da aula</label>
        <input id="a-titulo" name="titulo" required value="${esc(aula.titulo)}"></div>
      <div class="campo"><label for="a-video">Link do vídeo no Google Drive</label>
        <input id="a-video" name="video_url" required placeholder="https://drive.google.com/file/d/…/view" value="${esc(aula.video_url)}">
        <small class="texto-suave">No Drive: Compartilhar → “Qualquer pessoa com o link” → Copiar link.</small></div>
      <div class="previa-video" id="previa"></div>
      <div class="campo"><label for="a-duracao">Duração (minutos)</label>
        <input id="a-duracao" name="duracao_minutos" type="number" min="0" step="1" value="${esc(aula.duracao_minutos)}"></div>
      <div class="campo"><label for="a-descricao">Descrição / materiais (opcional)</label>
        <textarea id="a-descricao" name="descricao">${esc(aula.descricao)}</textarea></div>
      <div class="acoes">
        <button class="botao botao-escuro" type="submit">${editando ? "Salvar aula" : "Adicionar aula"}</button>
        ${editando ? `<button class="botao botao-claro" type="button" id="cancelar-aula">Cancelar</button>` : ""}
      </div>
    </form>`;

  const form = document.getElementById("form-aula");
  const msg = document.getElementById("msg-aula");
  const previa = document.getElementById("previa");

  const atualizarPrevia = () => {
    const valor = form.video_url.value.trim();
    const embed = linkIncorporado(valor);
    previa.innerHTML = !valor ? ""
      : embed ? `<div class="player"><iframe src="${esc(embed)}" title="Prévia" allowfullscreen></iframe></div>`
      : `<div class="aviso aviso-alerta">Link não reconhecido. Use o link de compartilhamento do Google Drive.</div>`;
  };
  form.video_url.addEventListener("change", atualizarPrevia);
  atualizarPrevia();

  document.getElementById("cancelar-aula")?.addEventListener("click", () => painelAulas(cursoId));

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!linkIncorporado(form.video_url.value)) {
      return mostrarMensagem(msg, "Link de vídeo não reconhecido. Use o link de compartilhamento do Google Drive.");
    }
    const dados = {
      titulo: form.titulo.value.trim(),
      video_url: form.video_url.value.trim(),
      duracao_minutos: Number(form.duracao_minutos.value) || 0,
      descricao: form.descricao.value.trim(),
    };
    const { error: erro } = editando
      ? await supabase.from("aulas").update(dados).eq("id", editando)
      : await supabase.from("aulas").insert({
          ...dados,
          curso_id: cursoId,
          ordem: aulas.reduce((m, a) => Math.max(m, a.ordem), 0) + 1,
        });
    if (erro) return mostrarMensagem(msg, mensagemErro(erro));
    await painelAulas(cursoId);
  });

  painel.querySelectorAll("[data-acao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const i = Number(botao.dataset.i);
      const alvo = aulas[i];
      const acao = botao.dataset.acao;

      if (acao === "editar") {
        await painelAulas(cursoId, alvo.id);
        document.getElementById("titulo-form-aula").scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (acao === "excluir") {
        if (!confirm(`Excluir a aula “${alvo.titulo}”?`)) return;
        const { error: erro } = await supabase.from("aulas").delete().eq("id", alvo.id);
        if (erro) return mostrarMensagem(msg, mensagemErro(erro));
        return painelAulas(cursoId);
      }

      // Subir/descer: renumera a lista inteira com a troca aplicada.
      const ordenadas = [...aulas];
      const j = acao === "subir" ? i - 1 : i + 1;
      [ordenadas[i], ordenadas[j]] = [ordenadas[j], ordenadas[i]];
      const resultados = await Promise.all(ordenadas.map((a, n) =>
        a.ordem === n + 1 ? { error: null }
          : supabase.from("aulas").update({ ordem: n + 1 }).eq("id", a.id)));
      const falha = resultados.find((r) => r.error);
      if (falha) return mostrarMensagem(msg, mensagemErro(falha.error));
      painelAulas(cursoId);
    }));
}

// --------------------------------------------------------------------------
// Relatório de cursistas de um curso
// --------------------------------------------------------------------------

async function telaRelatorio(id) {
  const [curso, relatorio] = await Promise.all([
    supabase.from("cursos").select("titulo, carga_horaria").eq("id", id).maybeSingle(),
    supabase.rpc("relatorio_curso", { p_curso: id }),
  ]);
  if (curso.error) throw curso.error;
  if (relatorio.error) throw relatorio.error;
  if (!curso.data) throw new Error("Curso não encontrado.");

  const linhas = relatorio.data;
  const concluintes = linhas.filter((l) => l.total_aulas && l.aulas_concluidas >= l.total_aulas).length;

  tela().innerHTML = `
    <p><a href="#cursos">← Voltar aos cursos</a></p>
    <div class="cartao">
      <div class="acoes" style="justify-content:space-between">
        <div>
          <h2 style="margin:0">Relatório — ${esc(curso.data.titulo)}</h2>
          <p class="texto-suave">${linhas.length} cursistas iniciaram · ${concluintes} concluíram ·
            ${linhas.filter((l) => l.certificado).length} certificados emitidos</p>
        </div>
        ${linhas.length ? `<button class="botao" id="baixar-csv">Baixar planilha (CSV)</button>` : ""}
      </div>
      ${linhas.length === 0
        ? `<p class="texto-suave">Nenhum cursista iniciou este curso ainda.</p>`
        : `<div class="tabela-rolagem"><table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Escola</th><th>Progresso</th><th>Tempo</th><th>Última atividade</th><th>Certificado</th></tr></thead>
            <tbody>${linhas.map((l) => {
              const pct = l.total_aulas ? Math.round((l.aulas_concluidas / l.total_aulas) * 100) : 0;
              return `<tr>
                <td>${esc(l.nome || "—")}</td>
                <td>${esc(l.email)}</td>
                <td>${esc(l.escola || "—")}</td>
                <td style="min-width:130px">
                  <div class="barra"><span style="width:${pct}%"></span></div>
                  <small>${l.aulas_concluidas}/${l.total_aulas} aulas (${pct}%)</small></td>
                <td>${formatarHoras(l.minutos_concluidos)}</td>
                <td>${l.ultima_atividade ? formatarData(l.ultima_atividade) : "—"}</td>
                <td>${l.certificado
                  ? `<a href="certificado.html?codigo=${esc(l.certificado)}">${esc(l.certificado)}</a>`
                  : "—"}</td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>`}
    </div>`;

  document.getElementById("baixar-csv")?.addEventListener("click", () => {
    const cabecalho = ["Nome", "E-mail", "Escola", "Aulas concluídas", "Total de aulas", "Minutos assistidos", "Última atividade", "Certificado"];
    const corpo = linhas.map((l) => [
      l.nome, l.email, l.escola, l.aulas_concluidas, l.total_aulas, l.minutos_concluidos,
      l.ultima_atividade ? new Date(l.ultima_atividade).toLocaleString("pt-BR") : "", l.certificado ?? "",
    ]);
    const csv = [cabecalho, ...corpo]
      .map((linha) => linha.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `relatorio-${curso.data.titulo}.csv`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

// --------------------------------------------------------------------------
// Usuários
// --------------------------------------------------------------------------

async function telaUsuarios() {
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, email, escola, admin, criado_em")
    .order("nome");
  if (error) throw error;

  tela().innerHTML = `
    <div class="cartao">
      <h2>Usuários (${data.length})</h2>
      <div id="msg-usuarios"></div>
      <div class="campo" style="max-width:360px;margin-bottom:12px">
        <label for="busca">Buscar</label><input id="busca" placeholder="Nome, e-mail ou escola"></div>
      <div class="tabela-rolagem"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Escola</th><th>Cadastro</th><th>Acesso</th></tr></thead>
        <tbody>${data.map((u) => `
          <tr data-busca="${esc(`${u.nome} ${u.email} ${u.escola}`.toLowerCase())}">
            <td>${esc(u.nome || "—")}</td>
            <td>${esc(u.email)}</td>
            <td>${esc(u.escola || "—")}</td>
            <td>${formatarData(u.criado_em)}</td>
            <td>${u.id === perfil.id
              ? `<span class="etiqueta">Administrador (você)</span>`
              : `<button class="botao botao-pequeno ${u.admin ? "botao-perigo" : "botao-claro"}"
                   data-id="${u.id}" data-admin="${u.admin}">
                   ${u.admin ? "Remover admin" : "Tornar admin"}</button>`}</td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>`;

  document.getElementById("busca").addEventListener("input", (e) => {
    const termo = e.target.value.trim().toLowerCase();
    tela().querySelectorAll("tbody tr").forEach((tr) =>
      tr.classList.toggle("oculto", !tr.dataset.busca.includes(termo)));
  });

  tela().querySelectorAll("button[data-id]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const tornar = botao.dataset.admin !== "true";
      if (tornar && !confirm("Dar acesso de administrador a este usuário? Ele poderá criar, editar e excluir cursos.")) return;
      const { error: erro } = await supabase.rpc("definir_admin", { p_usuario: botao.dataset.id, p_admin: tornar });
      if (erro) return mostrarMensagem(document.getElementById("msg-usuarios"), mensagemErro(erro));
      telaUsuarios();
    }));
}

iniciar().catch((erro) => {
  main.innerHTML = `<div class="container secao"><div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div></div>`;
});
