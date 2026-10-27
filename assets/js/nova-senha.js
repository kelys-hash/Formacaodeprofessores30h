// Página aberta pelo link de recuperação de senha enviado por e-mail.

import {
  supabase, configurado, montarPagina, avisoNaoConfigurado, mensagemErro, mostrarMensagem,
} from "./app.js";

const main = document.getElementById("conteudo");

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();
  montarPagina(null, "");

  main.innerHTML = `
    <section class="container secao">
      <div class="cartao cartao-estreito">
        <h1>Criar nova senha</h1>
        <div id="mensagem"></div>
        <form class="formulario" id="form-senha">
          <div class="campo"><label for="senha">Nova senha (mínimo 6 caracteres)</label>
            <input id="senha" name="senha" type="password" minlength="6" autocomplete="new-password" required></div>
          <button class="botao botao-escuro" type="submit">Salvar senha</button>
        </form>
      </div>
    </section>`;

  const mensagem = document.getElementById("mensagem");
  const form = document.getElementById("form-senha");

  // O Supabase lê o token do link e abre a sessão sozinho; damos um instante.
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await new Promise((r) => setTimeout(r, 800));
    const nova = await supabase.auth.getSession();
    if (!nova.data.session) {
      mostrarMensagem(mensagem, "Link inválido ou expirado. Peça um novo em “Esqueci a senha”.");
      form.classList.add("oculto");
      return;
    }
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: form.senha.value });
    if (error) return mostrarMensagem(mensagem, mensagemErro(error));
    form.classList.add("oculto");
    mostrarMensagem(mensagem, "Senha alterada! Redirecionando…", "sucesso");
    setTimeout(() => location.replace("index.html"), 1500);
  });
}

iniciar();
