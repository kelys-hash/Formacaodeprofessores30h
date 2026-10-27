// Meu perfil: nome que sai no certificado, escola e certificados emitidos.

import {
  supabase, configurado, exigirLogin, montarPagina, avisoNaoConfigurado,
  esc, formatarCarga, formatarData, mensagemErro, mostrarMensagem,
} from "./app.js";

const main = document.getElementById("conteudo");

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  const perfil = await exigirLogin();
  montarPagina(perfil, "perfil");

  const certificados = await supabase
    .from("certificados")
    .select("codigo, titulo_curso, carga_horaria, emitido_em")
    .eq("usuario_id", perfil.id)
    .order("emitido_em", { ascending: false });
  if (certificados.error) throw certificados.error;

  main.innerHTML = `
    <section class="container secao">
      <div class="admin-grade">
        <div class="cartao">
          <h1>Meu perfil</h1>
          <div id="mensagem"></div>
          <form class="formulario" id="form-perfil">
            <div class="campo"><label for="nome">Nome completo (como sairá no certificado)</label>
              <input id="nome" name="nome" required value="${esc(perfil.nome)}"></div>
            <div class="campo"><label for="escola">Escola</label>
              <input id="escola" name="escola" value="${esc(perfil.escola)}"></div>
            <div class="campo"><label>E-mail</label>
              <input value="${esc(perfil.email)}" disabled></div>
            <div class="acoes"><button class="botao botao-escuro" type="submit">Salvar</button></div>
          </form>
          <p class="texto-suave">O nome é gravado no certificado no momento da emissão.</p>
        </div>
        <div class="cartao">
          <h2>Meus certificados</h2>
          ${certificados.data.length === 0
            ? `<p class="texto-suave">Você ainda não tem certificados. Conclua todas as aulas de um curso para emitir o seu.</p>`
            : `<ul class="lista-aulas">${certificados.data.map((c) => `
                <li><a class="cartao" style="display:block;padding:12px;text-decoration:none;box-shadow:none"
                       href="certificado.html?codigo=${esc(c.codigo)}">
                  <strong>${esc(c.titulo_curso)}</strong>
                  <small class="texto-suave" style="display:block">${formatarCarga(c.carga_horaria)} ·
                    emitido em ${formatarData(c.emitido_em)}</small>
                </a></li>`).join("")}</ul>`}
        </div>
      </div>
    </section>`;

  const form = document.getElementById("form-perfil");
  const mensagem = document.getElementById("mensagem");
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nome = form.nome.value.trim();
    const escola = form.escola.value.trim();
    const { error } = await supabase.from("perfis").update({ nome, escola }).eq("id", perfil.id);
    if (error) return mostrarMensagem(mensagem, mensagemErro(error));
    mostrarMensagem(mensagem, "Dados salvos.", "sucesso");
  });
}

iniciar().catch((erro) => {
  main.innerHTML = `<div class="container secao"><div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div></div>`;
});
