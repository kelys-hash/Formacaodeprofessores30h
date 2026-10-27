// ==========================================================================
// Código compartilhado por todas as páginas: conexão com o Supabase,
// sessão do usuário, cabeçalho e pequenas funções de apoio.
// ==========================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { CONFIG } from "./config.js";

export { CONFIG };

export const configurado = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export const supabase = configurado
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

// --------------------------------------------------------------------------
// Sessão e perfil
// --------------------------------------------------------------------------

export async function usuarioAtual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function perfilAtual() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome, email, escola, admin")
    .eq("id", usuario.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Manda para a página de login se não houver sessão; devolve o perfil.
export async function exigirLogin() {
  const perfil = await perfilAtual();
  if (!perfil) {
    const volta = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.replace(`entrar.html?volta=${volta}`);
    return new Promise(() => {}); // a página está sendo trocada
  }
  return perfil;
}

export async function sair() {
  await supabase.auth.signOut();
  location.href = "index.html";
}

// --------------------------------------------------------------------------
// Cabeçalho e rodapé
// --------------------------------------------------------------------------

export function montarPagina(perfil, ativo) {
  document.title = document.title
    ? `${document.title} — ${CONFIG.NOME_SITE}`
    : CONFIG.NOME_SITE;

  const topo = document.getElementById("topo");
  const links = [
    ["index.html", "Cursos", "cursos"],
    ...(perfil ? [["perfil.html", "Meu perfil", "perfil"]] : []),
    ...(perfil?.admin ? [["admin.html", "Administração", "admin"]] : []),
  ];
  topo.innerHTML = `
    <div class="container topo-conteudo">
      <a class="marca" href="index.html">
        <span class="marca-icone" aria-hidden="true">▶</span>
        <span>
          <strong>${esc(CONFIG.NOME_SITE)}</strong>
          <small>${esc(CONFIG.INSTITUICAO)}</small>
        </span>
      </a>
      <nav class="menu" aria-label="Menu principal">
        ${links
          .map(([href, texto, id]) =>
            `<a href="${href}"${id === ativo ? ' aria-current="page"' : ""}>${texto}</a>`)
          .join("")}
        ${perfil
          ? `<button type="button" class="botao botao-claro" id="botao-sair">Sair</button>`
          : `<a class="botao" href="entrar.html">Entrar</a>`}
      </nav>
    </div>`;
  document.getElementById("botao-sair")?.addEventListener("click", sair);

  const rodape = document.getElementById("rodape");
  if (rodape) {
    rodape.innerHTML = `<div class="container">
      ${esc(CONFIG.NOME_SITE)} · ${esc(CONFIG.INSTITUICAO)} ·
      <a href="certificado.html">Verificar certificado</a>
    </div>`;
  }
}

// Mostra o aviso de configuração pendente e interrompe a página.
export function avisoNaoConfigurado() {
  montarPagina(null, "");
  document.querySelector("main").innerHTML = `
    <section class="container secao">
      <div class="aviso aviso-alerta">
        <h2>Falta configurar o banco de dados</h2>
        <p>Preencha <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> no arquivo
        <code>assets/js/config.js</code>. O passo a passo está no <code>README.md</code>.</p>
      </div>
    </section>`;
}

// --------------------------------------------------------------------------
// Funções de apoio
// --------------------------------------------------------------------------

export function esc(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parametro(nome) {
  return new URLSearchParams(location.search).get(nome);
}

// Converte o link de compartilhamento em endereço para incorporar o vídeo.
// Aceita Google Drive (principal) e, por conveniência, YouTube.
export function linkIncorporado(url) {
  const texto = String(url ?? "").trim();
  const drive =
    texto.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    texto.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  const youtube = texto.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  return null;
}

export function formatarHoras(minutos) {
  const total = Math.round(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function formatarCarga(horas) {
  const n = Number(horas);
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// Traduz as mensagens de erro mais comuns do Supabase.
export function mensagemErro(erro) {
  const msg = erro?.message ?? String(erro);
  const traducoes = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
    "User already registered": "Já existe uma conta com este e-mail.",
    "Password should be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres.",
  };
  for (const [ingles, portugues] of Object.entries(traducoes)) {
    if (msg.includes(ingles)) return portugues;
  }
  if (msg.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  return msg;
}

export function mostrarMensagem(alvo, texto, tipo = "erro") {
  alvo.innerHTML = texto ? `<div class="aviso aviso-${tipo}" role="status">${esc(texto)}</div>` : "";
}
