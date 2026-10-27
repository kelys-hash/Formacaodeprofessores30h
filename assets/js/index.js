// Catálogo de cursos publicados, com o progresso de quem está logado.

import {
  CONFIG, supabase, configurado, perfilAtual, montarPagina, avisoNaoConfigurado,
  esc, formatarCarga, mensagemErro,
} from "./app.js";

const main = document.getElementById("conteudo");

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  const perfil = await perfilAtual();
  montarPagina(perfil, "cursos");

  main.innerHTML = `
    <section class="cabecalho-pagina">
      <div class="container">
        <h1>Cursos disponíveis</h1>
        <p>${perfil
          ? `Olá, ${esc(perfil.nome || perfil.email)}! Escolha um curso para continuar de onde parou.`
          : `Formação continuada da ${esc(CONFIG.INSTITUICAO)}. Entre ou crie sua conta para assistir às aulas e receber o certificado.`}</p>
      </div>
    </section>
    <section class="container secao">
      <div id="cursos"><p class="carregando">Carregando cursos…</p></div>
    </section>`;

  const alvo = document.getElementById("cursos");

  const [cursos, progresso, certificados] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, titulo, descricao, carga_horaria, capa_url, aulas(id)")
      .eq("publicado", true)
      .order("criado_em", { ascending: false }),
    perfil ? supabase.from("progresso").select("aula_id") : { data: [] },
    perfil ? supabase.from("certificados").select("curso_id") : { data: [] },
  ]);

  if (cursos.error) {
    alvo.innerHTML = `<div class="aviso aviso-erro">${esc(mensagemErro(cursos.error))}</div>`;
    return;
  }
  if (cursos.data.length === 0) {
    alvo.innerHTML = `<div class="aviso aviso-info">Nenhum curso publicado ainda.</div>`;
    return;
  }

  const concluidas = new Set((progresso.data ?? []).map((p) => p.aula_id));
  const comCertificado = new Set((certificados.data ?? []).map((c) => c.curso_id));

  alvo.innerHTML = `<div class="grade-cursos">${cursos.data
    .map((curso) => cartaoCurso(curso, perfil, concluidas, comCertificado))
    .join("")}</div>`;
}

function cartaoCurso(curso, perfil, concluidas, comCertificado) {
  const total = curso.aulas.length;
  const feitas = curso.aulas.filter((a) => concluidas.has(a.id)).length;
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  const destino = perfil ? `curso.html?id=${curso.id}` : `entrar.html?volta=${encodeURIComponent(`curso.html?id=${curso.id}`)}`;

  let situacao = "";
  if (perfil && total) {
    situacao = `
      <div class="barra" aria-label="Progresso ${pct}%"><span style="width:${pct}%"></span></div>
      <span class="texto-suave">${feitas} de ${total} aulas concluídas</span>`;
  }

  return `
    <a class="curso-card" href="${destino}">
      <div class="curso-capa">${curso.capa_url
        ? `<img src="${esc(curso.capa_url)}" alt="" loading="lazy">`
        : "▶"}</div>
      <div class="curso-corpo">
        <div class="etiquetas">
          <span class="etiqueta">${formatarCarga(curso.carga_horaria)}</span>
          ${perfil ? `<span class="etiqueta">${total} ${total === 1 ? "aula" : "aulas"}</span>` : ""}
          ${comCertificado.has(curso.id) ? `<span class="etiqueta etiqueta-sucesso">Certificado emitido</span>` : ""}
        </div>
        <h3>${esc(curso.titulo)}</h3>
        <p>${esc(resumir(curso.descricao, 160))}</p>
        ${situacao}
      </div>
    </a>`;
}

function resumir(texto, limite) {
  return texto.length > limite ? `${texto.slice(0, limite).trimEnd()}…` : texto;
}

iniciar().catch((erro) => {
  main.innerHTML = `<div class="container secao"><div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div></div>`;
});
