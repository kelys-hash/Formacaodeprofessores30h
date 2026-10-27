// Exibe, valida e gera o PDF do certificado a partir do código.
// A página é pública: qualquer pessoa com o código pode conferir a validade.

import {
  CONFIG, supabase, configurado, perfilAtual, montarPagina, avisoNaoConfigurado,
  esc, parametro, formatarData, mensagemErro,
} from "./app.js";

const main = document.getElementById("conteudo");

function textoCarga(horas) {
  const n = Number(horas);
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n === 1 ? "hora" : "horas"}`;
}

function linkVerificacao(codigo) {
  const url = new URL("certificado.html", location.href);
  url.search = `?codigo=${encodeURIComponent(codigo)}`;
  return url.href;
}

async function iniciar() {
  if (!configurado) return avisoNaoConfigurado();

  montarPagina(await perfilAtual(), "");
  const codigo = (parametro("codigo") ?? "").trim();

  if (!codigo) return desenharBusca();

  const { data, error } = await supabase.rpc("verificar_certificado", { p_codigo: codigo });
  if (error) throw error;
  if (!data.length) return desenharBusca(`Nenhum certificado encontrado com o código “${codigo}”.`);

  desenharCertificado(data[0]);
}

function desenharBusca(erro = "") {
  main.innerHTML = `
    <section class="container secao">
      <div class="cartao cartao-estreito">
        <h1>Verificar certificado</h1>
        <p class="texto-suave">Digite o código impresso no certificado para conferir se ele é válido.</p>
        ${erro ? `<div class="aviso aviso-erro">${esc(erro)}</div>` : ""}
        <form class="formulario" method="get">
          <div class="campo"><label for="codigo">Código</label>
            <input id="codigo" name="codigo" required autocomplete="off" style="text-transform:uppercase"></div>
          <button class="botao botao-escuro" type="submit">Verificar</button>
        </form>
      </div>
    </section>`;
}

function desenharCertificado(cert) {
  main.innerHTML = `
    <section class="container secao">
      <div class="aviso aviso-sucesso">✓ Certificado válido — código <strong>${esc(cert.codigo)}</strong></div>
      <div class="certificado" id="certificado">
        <p class="texto-suave">${esc(CONFIG.INSTITUICAO)}</p>
        <h1 class="titulo-cert">CERTIFICADO</h1>
        <p>Certificamos que</p>
        <p class="nome-cert">${esc(cert.nome_cursista)}</p>
        <p>concluiu o curso <strong>${esc(cert.titulo_curso)}</strong>,
           com carga horária de <strong>${textoCarga(cert.carga_horaria)}</strong>.</p>
        <p>${esc(CONFIG.CIDADE)}, ${formatarData(cert.emitido_em)}.</p>
        ${CONFIG.ASSINATURA_NOME ? `
          <div style="margin:40px auto 0;max-width:320px;border-top:1px solid var(--navy);padding-top:6px">
            <strong>${esc(CONFIG.ASSINATURA_NOME)}</strong><br>
            <span class="texto-suave">${esc(CONFIG.ASSINATURA_CARGO)}</span>
          </div>` : ""}
        <p class="codigo-cert">Código de verificação: ${esc(cert.codigo)}<br>${esc(linkVerificacao(cert.codigo))}</p>
      </div>
      <div class="acoes" style="justify-content:center;margin-top:20px">
        <button class="botao botao-escuro" id="baixar">Baixar PDF</button>
      </div>
    </section>`;

  document.getElementById("baixar").addEventListener("click", () => gerarPdf(cert));
}

function gerarPdf(cert) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = 297;
  const centro = largura / 2;
  const navy = [22, 33, 62];

  // Moldura dupla
  doc.setDrawColor(...navy);
  doc.setLineWidth(1.6);
  doc.rect(10, 10, largura - 20, 190);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, largura - 28, 182);

  doc.setTextColor(90, 100, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(CONFIG.INSTITUICAO, centro, 36, { align: "center" });

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("C E R T I F I C A D O", centro, 58, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(60, 70, 90);
  doc.text("Certificamos que", centro, 80, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...navy);
  doc.text(cert.nome_cursista, centro, 96, { align: "center", maxWidth: 250 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(60, 70, 90);
  const frase = `concluiu o curso "${cert.titulo_curso}", com carga horária de ${textoCarga(cert.carga_horaria)}.`;
  const linhas = doc.splitTextToSize(frase, 230);
  doc.text(linhas, centro, 114, { align: "center", lineHeightFactor: 1.4 });

  const yData = 114 + linhas.length * 8 + 6;
  doc.text(`${CONFIG.CIDADE}, ${formatarData(cert.emitido_em)}.`, centro, yData, { align: "center" });

  if (CONFIG.ASSINATURA_NOME) {
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.3);
    doc.line(centro - 45, 165, centro + 45, 165);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(CONFIG.ASSINATURA_NOME, centro, 171, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(CONFIG.ASSINATURA_CARGO, centro, 176, { align: "center" });
  }

  doc.setFontSize(9);
  doc.setTextColor(110, 120, 140);
  doc.text(`Código de verificação: ${cert.codigo} — ${linkVerificacao(cert.codigo)}`, centro, 189, { align: "center" });

  const nomeArquivo = `certificado-${cert.titulo_curso}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`${nomeArquivo}.pdf`);
}

iniciar().catch((erro) => {
  main.innerHTML = `<div class="container secao"><div class="aviso aviso-erro">${esc(mensagemErro(erro))}</div></div>`;
});
