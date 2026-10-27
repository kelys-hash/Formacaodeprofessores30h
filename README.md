# Formação de Professores — plataforma de cursos em vídeo

Site para publicar cursos com aulas em vídeo (Google Drive), com login de
cursistas, controle de progresso e carga horária, e certificado em PDF com
código de verificação.

É um site estático (HTML, CSS e JavaScript puro, sem etapa de build) que usa o
[Supabase](https://supabase.com) — gratuito — como banco de dados e login. Pode
ser publicado no GitHub Pages.

## O que o sistema faz

**Cursistas (professores)**
- Criam conta com nome, escola, e-mail e senha; recuperam a senha por e-mail.
- Veem o catálogo de cursos com o próprio progresso.
- Assistem às aulas e marcam cada uma como concluída.
- Acompanham aulas concluídas, porcentagem e horas de vídeo assistidas.
- Ao concluir todas as aulas, emitem o certificado e baixam o PDF.

**Administradores**
- Criam, editam, publicam e excluem cursos (título, descrição, carga horária, capa).
- Adicionam aulas colando o link do Google Drive, com prévia do vídeo;
  editam, reordenam e excluem aulas.
- Veem o relatório de cada curso (quem iniciou, progresso, tempo, certificado)
  e baixam como planilha CSV.
- Dão ou retiram acesso de administrador a outros usuários.

**Qualquer pessoa** pode conferir um certificado pelo código, em
`certificado.html`.

## Estrutura

```
.
├── index.html          # Catálogo de cursos
├── entrar.html         # Login, criação de conta, recuperação de senha
├── nova-senha.html     # Página aberta pelo link de recuperação de senha
├── curso.html          # Player, lista de aulas, progresso e certificado
├── perfil.html         # Nome, escola e certificados do cursista
├── certificado.html    # Certificado, PDF e verificação pública
├── admin.html          # Painel do administrador
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js   # ← suas chaves do Supabase e textos do certificado
│       ├── app.js      # Código compartilhado
│       └── *.js        # Um arquivo por página
└── supabase/
    └── schema.sql      # Tabelas, regras de segurança e funções
```

## Como colocar no ar

### 1. Criar o banco no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**.
2. No projeto, abra **SQL Editor**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Abra **Project Settings → API** e copie a **Project URL** e a chave
   **anon public**.

### 2. Configurar o site

Edite [`assets/js/config.js`](assets/js/config.js):

```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

No mesmo arquivo, ajuste o nome do site, a instituição, a cidade e a assinatura
que aparecem no certificado.

> A chave `anon` é pública por natureza: a segurança fica nas regras do banco
> (Row Level Security) definidas no `schema.sql`. **Nunca** coloque a chave
> `service_role` no site.

### 3. Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**, selecione a branch
   principal e a pasta `/ (root)`, e salve.
3. O endereço será algo como `https://SEU-USUARIO.github.io/Formacaodeprofessores30h/`.

### 4. Ajustar o login no Supabase

Em **Authentication → URL Configuration**:
- **Site URL**: o endereço do GitHub Pages.
- **Redirect URLs**: adicione `https://SEU-USUARIO.github.io/Formacaodeprofessores30h/**`.

Isso faz os links de confirmação de e-mail e de recuperação de senha voltarem
para o site. Se preferir que os cursistas entrem sem confirmar o e-mail,
desative **Confirm email** em **Authentication → Providers → Email**.

> O envio de e-mails do plano gratuito do Supabase tem limite baixo por hora.
> Para muitos cadastros de uma vez, configure um SMTP próprio em
> **Authentication → Emails → SMTP Settings**.

### 5. Tornar-se administrador

1. Crie sua conta pelo próprio site (**Entrar → Criar conta**).
2. No **SQL Editor** do Supabase, rode, com o seu e-mail:

   ```sql
   update public.perfis set admin = true where email = 'seu-email@exemplo.com';
   ```

3. Saia e entre de novo: o menu **Administração** aparece. A partir daí, outros
   administradores podem ser definidos pela aba **Usuários**.

## Como adicionar um vídeo do Google Drive

1. No Google Drive, clique com o botão direito no vídeo → **Compartilhar**.
2. Em **Acesso geral**, escolha **Qualquer pessoa com o link** (leitor).
3. Clique em **Copiar link** e cole no campo da aula, no painel de administração.

O sistema converte o link para o player do Drive automaticamente e mostra uma
prévia. Links do YouTube também são aceitos.

## Como funcionam o progresso e o certificado

- A carga horária do certificado é a informada no curso (ex.: 30h).
- A duração de cada aula (em minutos) serve para mostrar o tempo assistido.
- O certificado só é emitido quando **todas** as aulas estão concluídas. O
  nome, o curso e a carga horária ficam gravados no momento da emissão.
- Cada certificado tem um código único, verificável em
  `certificado.html?codigo=CÓDIGO`.

**Limitação:** o player do Google Drive não informa ao site quanto do vídeo foi
assistido. Por isso, a conclusão é marcada pelo próprio cursista, com o botão
**Marcar aula como concluída**.

## Visualizar localmente

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

(Com `config.js` preenchido. Abrir o `index.html` direto do disco não funciona,
porque os módulos JavaScript exigem um servidor.)
