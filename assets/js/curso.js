// Página do curso: player do vídeo, lista de aulas, progresso e certificado.

import {
  supabase, configurado, exigirLogin, montarPagina, avisoNaoConfigurado,
  esc, parametro, linkIncorporado, formatarHoras, formatarCarga, mensagemErro, mostrarMensagem,
} from "./app.js";

const main = document.getElementById("conteudo");

const estado = {
  perfil: null,
  curso: null,
  aulas: [],
  concluidas: new Set(),
  certificado: null,
  atual: 0,
};

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  estado.perfil = await exigirLogin();
  montarPagina(estado.perfil, "cursos");

  const id = parametro("id");
  const [curso, aulas, certificado] = await Promise.all([
    supabase.from("cursos").select("id, titulo, descricao, carga_horaria, publicado").eq("id", id).maybeSingle(),
    supabase.from("aulas")
      .select("id, titulo, descricao, video_url, duracao_minutos, ordem")
      .eq("curso_id", id)
      .order("ordem").order("criado_em"),
    supabase.from("certificados").select("codigo").eq("curso_id", id).eq("usuario_id", estado.perfil.id).maybeSingle(),
  ]);

  const erro = curso.error || aulas.error || certificado.error;
  if (erro) throw erro;
  if (!curso.data) {
    main.innerHTML = `<section class="container secao"><div class="aviso aviso-erro">
      Curso não encontrado. <a href="index.html">Voltar aos cursos</a></div></section>`;
    return;
  }

  estado.curso = curso.data;
  estado.aulas = aulas.data;
  estado.certificado = certificado.data;
  document.title = `${estado.curso.titulo} — ${document.title.split(" — ").pop()}`;

  if (estado.aulas.length) {
    const progresso = await supabase
      .from("progresso").select("aula_id")
      .eq("usuario_id", estado.perfil.id)
      .in("aula_id", estado.aulas.map((a) => a.id));
    if (progresso.error) throw progresso.error;
    estado.concluidas = new Set(progresso.data.map((p) => p.aula_id));
  }

  // Abre a aula pedida no link ou a primeira ainda não concluída.
  const pedida = estado.aulas.findIndex((a) => a.id === parametro("aula"));
  const pendente = estado.aulas.findIndex((a) => !estado.concluidas.has(a.id));
  estado.atual = pedida >= 0 ? pedida : Math.max(pendente, 0);

  desenhar();
}

function desenhar() {
  const { curso, aulas } = estado;

  main.innerHTML = `
    <section class="cabecalho-pagina">
      <div class="container">
        <p><a href="index.html" style="color:inherit">← Todos os cursos</a></p>
        <h1>${esc(curso.titulo)}</h1>
        <p>${esc(curso.descricao)}</p>
        <div class="etiquetas" style="margin-top:12px">
          <span class="etiqueta">Carga horária: ${formatarCarga(curso.carga_horaria)}</span>
          ${curso.publicado ? "" : `<span class="etiqueta etiqueta-rascunho">Rascunho — só administradores veem</span>`}
        </div>
      </div>
    </section>
    <section class="container secao">
      ${aulas.length === 0
        ? `<div class="aviso aviso-info">Este curso ainda não tem aulas.</div>`
        : `<div class="curso-layout">
            <div id="area-aula"></div>
            <aside class="cartao">
              <div class="resumo-progresso" id="resumo"></div>
              <ol class="lista-aulas" id="lista"></ol>
            </aside>
          </div>`}
    </section>`;

  if (aulas.length) {
    desenharAula();
    desenharLista();
    desenharResumo();
  }
}

function desenharAula() {
  const aula = estado.aulas[estado.atual];
  const embed = linkIncorporado(aula.video_url);
  const feita = estado.concluidas.has(aula.id);
  const ultima = estado.atual === estado.aulas.length - 1;

  document.getElementById("area-aula").innerHTML = `
    <div class="player">
      ${embed
        ? `<iframe src="${esc(embed)}" title="${esc(aula.titulo)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`
        : `<div class="player-vazio">Não foi possível exibir este vídeo.
            <a href="${esc(aula.video_url)}" target="_blank" rel="noopener" style="color:inherit">Abrir em nova aba</a></div>`}
    </div>
    <div class="cartao" style="margin-top:16px">
      <p class="texto-suave">Aula ${estado.atual + 1} de ${estado.aulas.length}
        ${aula.duracao_minutos ? ` · ${formatarHoras(aula.duracao_minutos)}` : ""}</p>
      <h2>${esc(aula.titulo)}</h2>
      ${aula.descricao ? `<p style="white-space:pre-line">${esc(aula.descricao)}</p>` : ""}
      <div id="msg-aula"></div>
      <div class="acoes">
        ${feita
          ? `<button class="botao botao-sucesso" id="alternar">✓ Aula concluída</button>
             <button class="botao botao-claro botao-pequeno" id="desmarcar">Desmarcar</button>`
          : `<button class="botao botao-escuro" id="alternar">Marcar aula como concluída</button>`}
        ${ultima ? "" : `<button class="botao" id="proxima">Próxima aula →</button>`}
      </div>
    </div>`;

  const msg = document.getElementById("msg-aula");
  if (!feita) document.getElementById("alternar").addEventListener("click", () => marcar(aula, true, msg));
  document.getElementById("desmarcar")?.addEventListener("click", () => marcar(aula, false, msg));
  document.getElementById("proxima")?.addEventListener("click", () => irPara(estado.atual + 1));
}

async function marcar(aula, concluir, msg) {
  main.querySelectorAll("#area-aula button").forEach((b) => (b.disabled = true));
  const { error } = concluir
    ? await supabase.from("progresso").insert({ aula_id: aula.id })
    : await supabase.from("progresso").delete().eq("aula_id", aula.id).eq("usuario_id", estado.perfil.id);

  // Já marcada em outra aba: tratamos como sucesso.
  if (error && error.code !== "23505") {
    main.querySelectorAll("#area-aula button").forEach((b) => (b.disabled = false));
    return mostrarMensagem(msg, mensagemErro(error));
  }
  if (concluir) estado.concluidas.add(aula.id);
  else estado.concluidas.delete(aula.id);

  desenharAula();
  desenharLista();
  desenharResumo();
}

function irPara(indice) {
  estado.atual = indice;
  const url = new URL(location.href);
  url.searchParams.set("aula", estado.aulas[indice].id);
  history.replaceState(null, "", url);
  desenharAula();
  desenharLista();
  document.getElementById("area-aula").scrollIntoView({ behavior: "smooth", block: "start" });
}

function desenharLista() {
  const lista = document.getElementById("lista");
  lista.innerHTML = estado.aulas.map((aula, i) => `
    <li class="${estado.concluidas.has(aula.id) ? "concluida" : ""}">
      <button type="button" data-i="${i}" aria-current="${i === estado.atual}">
        <span class="marcador" aria-hidden="true">${estado.concluidas.has(aula.id) ? "✓" : ""}</span>
        <span>${i + 1}. ${esc(aula.titulo)}
          ${aula.duracao_minutos ? `<small>${formatarHoras(aula.duracao_minutos)}</small>` : ""}</span>
      </button>
    </li>`).join("");
  lista.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => irPara(Number(b.dataset.i))));
}

function desenharResumo() {
  const { aulas, concluidas, curso } = estado;
  const feitas = aulas.filter((a) => concluidas.has(a.id));
  const pct = Math.round((feitas.length / aulas.length) * 100);
  const minutosFeitos = feitas.reduce((s, a) => s + a.duracao_minutos, 0);
  const minutosTotal = aulas.reduce((s, a) => s + a.duracao_minutos, 0);
  const completo = feitas.length === aulas.length;

  let certificado;
  if (estado.certificado) {
    certificado = `<a class="botao botao-sucesso" href="certificado.html?codigo=${esc(estado.certificado.codigo)}">Ver meu certificado</a>`;
  } else if (completo && curso.publicado) {
    certificado = `<button class="botao botao-sucesso" id="emitir">Emitir certificado</button>`;
  } else {
    certificado = `<p class="texto-suave">Conclua todas as aulas para liberar o certificado de ${formatarCarga(curso.carga_horaria)}.</p>`;
  }

  const resumo = document.getElementById("resumo");
  resumo.innerHTML = `
    <h3>Seu progresso</h3>
    <div class="barra" aria-label="Progresso ${pct}%"><span style="width:${pct}%"></span></div>
    <span class="texto-suave">${feitas.length} de ${aulas.length} aulas (${pct}%)
      ${minutosTotal ? ` · ${formatarHoras(minutosFeitos)} de ${formatarHoras(minutosTotal)} de vídeo` : ""}</span>
    <div id="msg-cert"></div>
    ${certificado}`;

  document.getElementById("emitir")?.addEventListener("click", emitirCertificado);
}

async function emitirCertificado() {
  const botao = document.getElementById("emitir");
  const msg = document.getElementById("msg-cert");
  botao.disabled = true;
  const { data, error } = await supabase.rpc("emitir_certificado", { p_curso: estado.curso.id });
  if (error) {
    botao.disabled = false;
    msg.innerHTML = `<div class="aviso aviso-erro">${esc(mensagemErro(error))}
      ${error.message.includes("nome") ? ` <a href="perfil.html">Ir para meu perfil</a>` : ""}</div>`;
    return;
  }
  location.href = `certificado.html?codigo=${encodeURIComponent(data.codigo)}`;
}

iniciar().catch((erro) => {
  main.innerHTML = `<div class="container secao"><div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div></div>`;
});
