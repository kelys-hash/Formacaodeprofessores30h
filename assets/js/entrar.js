// Login, criação de conta e recuperação de senha.

import {
  supabase, configurado, perfilAtual, montarPagina, avisoNaoConfigurado,
  parametro, mensagemErro, mostrarMensagem,
} from "./app.js";

const main = document.getElementById("conteudo");

// Só aceita voltar para uma página deste site.
function destinoAposLogin() {
  const volta = parametro("volta") ?? "";
  return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(volta) ? volta : "index.html";
}

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  const perfil = await perfilAtual();
  if (perfil) {
    location.replace(destinoAposLogin());
    return;
  }
  montarPagina(null, "");

  main.innerHTML = `
    <section class="container secao">
      <div class="cartao cartao-estreito">
        <div class="abas" role="tablist">
          <button class="aba" role="tab" data-aba="entrar" aria-selected="true">Entrar</button>
          <button class="aba" role="tab" data-aba="cadastrar" aria-selected="false">Criar conta</button>
          <button class="aba" role="tab" data-aba="esqueci" aria-selected="false">Esqueci a senha</button>
        </div>
        <div id="mensagem"></div>

        <form class="formulario" data-painel="entrar">
          <div class="campo"><label for="e-email">E-mail</label>
            <input id="e-email" name="email" type="email" autocomplete="email" required></div>
          <div class="campo"><label for="e-senha">Senha</label>
            <input id="e-senha" name="senha" type="password" autocomplete="current-password" required></div>
          <button class="botao botao-escuro" type="submit">Entrar</button>
        </form>

        <form class="formulario oculto" data-painel="cadastrar">
          <div class="campo"><label for="c-nome">Nome completo (sairá no certificado)</label>
            <input id="c-nome" name="nome" autocomplete="name" required></div>
          <div class="campo"><label for="c-escola">Escola</label>
            <input id="c-escola" name="escola"></div>
          <div class="campo"><label for="c-email">E-mail</label>
            <input id="c-email" name="email" type="email" autocomplete="email" required></div>
          <div class="campo"><label for="c-senha">Senha (mínimo 6 caracteres)</label>
            <input id="c-senha" name="senha" type="password" minlength="6" autocomplete="new-password" required></div>
          <button class="botao botao-escuro" type="submit">Criar conta</button>
        </form>

        <form class="formulario oculto" data-painel="esqueci">
          <p class="texto-suave">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
          <div class="campo"><label for="r-email">E-mail</label>
            <input id="r-email" name="email" type="email" autocomplete="email" required></div>
          <button class="botao botao-escuro" type="submit">Enviar link</button>
        </form>
      </div>
    </section>`;

  const mensagem = document.getElementById("mensagem");

  main.querySelectorAll(".aba").forEach((aba) =>
    aba.addEventListener("click", () => {
      main.querySelectorAll(".aba").forEach((a) => a.setAttribute("aria-selected", a === aba));
      main.querySelectorAll("[data-painel]").forEach((f) =>
        f.classList.toggle("oculto", f.dataset.painel !== aba.dataset.aba));
      mostrarMensagem(mensagem, "");
    }));

  const enviar = (painel, acao) => {
    const form = main.querySelector(`[data-painel="${painel}"]`);
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const botao = form.querySelector("button");
      botao.disabled = true;
      mostrarMensagem(mensagem, "");
      try {
        await acao(Object.fromEntries(new FormData(form)));
      } catch (erro) {
        mostrarMensagem(mensagem, mensagemErro(erro));
      } finally {
        botao.disabled = false;
      }
    });
  };

  enviar("entrar", async ({ email, senha }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    location.replace(destinoAposLogin());
  });

  enviar("cadastrar", async ({ nome, escola, email, senha }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome: nome.trim(), escola: escola.trim() },
        emailRedirectTo: new URL("entrar.html", location.href).href,
      },
    });
    if (error) throw error;
    if (data.session) {
      location.replace(destinoAposLogin());
    } else {
      mostrarMensagem(mensagem,
        "Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre aqui.",
        "sucesso");
    }
  });

  enviar("esqueci", async ({ email }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("nova-senha.html", location.href).href,
    });
    if (error) throw error;
    mostrarMensagem(mensagem, "Se houver uma conta com este e-mail, você receberá o link em instantes.", "sucesso");
  });
}

iniciar();
