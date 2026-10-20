import { ouvirEstadoAuth, ehAdmin, entrar, sair } from "./services/auth.js";
import { iniciarPainelAdmin } from "./modules/dashboard.js";
import { iniciarLoadingGlobal } from "./utils/loadingUI.js";
import { registrarErroCliente, toast } from "./utils/utils.js";
import { trocarAba } from "./utils/modal.js";
import { ICONS } from "./utils/icons.js";

iniciarLoadingGlobal();

const BLOQUEIO_MS = 15 * 60_000;
const MAX_TENTATIVAS = 5;

function aplicarIcones() {
  document.querySelectorAll("[data-icon]").forEach((elemento) => {
    if (ICONS[elemento.dataset.icon]) elemento.innerHTML = ICONS[elemento.dataset.icon];
  });
  const logo = document.querySelector("#admin-logo-icon");
  if (logo && ICONS.logo) logo.innerHTML = ICONS.logo;
}

function chaveTentativas(email) { return `gerencia-futura:tentativas:${email.trim().toLowerCase()}`; }
function lerTentativas(email) {
  try {
    const dados = JSON.parse(localStorage.getItem(chaveTentativas(email)) || "null");
    if (!dados || !Number.isFinite(dados.quantidade)) return { quantidade: 0, bloqueadoAte: 0 };
    if (dados.bloqueadoAte && Date.now() >= dados.bloqueadoAte) { localStorage.removeItem(chaveTentativas(email)); return { quantidade: 0, bloqueadoAte: 0 }; }
    return dados;
  } catch { return { quantidade: 0, bloqueadoAte: 0 }; }
}
function salvarTentativas(email, dados) { localStorage.setItem(chaveTentativas(email), JSON.stringify(dados)); }
function textoBloqueio(ate) {
  const minutos = Math.max(1, Math.ceil((ate - Date.now()) / 60_000));
  return `Acesso temporariamente bloqueado. Tente novamente em ${minutos} minuto${minutos === 1 ? "" : "s"}.`;
}
function registrarFalha(email) {
  const atual = lerTentativas(email);
  const quantidade = atual.quantidade + 1;
  if (quantidade >= MAX_TENTATIVAS) {
    const bloqueadoAte = Date.now() + BLOQUEIO_MS;
    salvarTentativas(email, { quantidade, bloqueadoAte });
    return textoBloqueio(bloqueadoAte);
  }
  salvarTentativas(email, { quantidade, bloqueadoAte: 0 });
  return `E-mail ou senha inválidos. Restam ${MAX_TENTATIVAS - quantidade} tentativa${MAX_TENTATIVAS - quantidade === 1 ? "" : "s"}.`;
}
function erroDeConfiguracao(erro) {
  const codigo = String(erro?.code || "").toLowerCase();
  return codigo.includes("api-key") || codigo.includes("referer") || codigo.includes("operation-not-allowed") || codigo.includes("network-request-failed");
}
function limparEntrada(valor) {
  return String(valor || "").replace(/[<>`{}]/g, "").replace(/[\u0000-\u001F\u007F]/g, "");
}
function configurarProtecaoInputs(formulario) {
  formulario.querySelectorAll("[data-protected-input]").forEach((campo) => {
    campo.addEventListener("input", () => { campo.value = limparEntrada(campo.value); });
    campo.addEventListener("paste", (evento) => {
      const texto = limparEntrada(evento.clipboardData?.getData("text") || "");
      if (texto !== evento.clipboardData?.getData("text")) { evento.preventDefault(); document.execCommand("insertText", false, texto); }
    });
  });
}
function configurarOlho(formulario) {
  const botao = formulario.querySelector("[data-toggle-password]");
  const senha = formulario.elements.senha;
  botao?.addEventListener("click", () => {
    const visivel = senha.type === "text";
    senha.type = visivel ? "password" : "text";
    botao.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
    botao.innerHTML = visivel
      ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" stroke-width="1.8"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17 17 0 0 1-3 3.7M6.2 6.2A17.4 17.4 0 0 0 2.5 12S5.9 18 12 18c1.3 0 2.5-.3 3.5-.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  });
}

function iniciarLogin() {
  const formulario = document.querySelector("#form-login-admin");
  if (!formulario) return false;
  configurarProtecaoInputs(formulario);
  configurarOlho(formulario);
  const erro = document.querySelector("#erro-login-admin");
  ouvirEstadoAuth((usuario) => { if (usuario && ehAdmin()) window.location.replace("/index.html"); });
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.textContent = "";
    const email = limparEntrada(formulario.email.value).trim().toLowerCase();
    formulario.email.value = email;
    formulario.senha.value = limparEntrada(formulario.senha.value);
    const estado = lerTentativas(email);
    if (estado.bloqueadoAte > Date.now()) { erro.textContent = textoBloqueio(estado.bloqueadoAte); return; }
    try {
      await entrar(email, formulario.senha.value, formulario.manterLogin.checked);
      localStorage.removeItem(chaveTentativas(email));
    } catch (erroLogin) {
      if (erroDeConfiguracao(erroLogin)) {
        erro.textContent = "A conexão com o Firebase foi bloqueada. Confira a configuração da chave de API e o domínio autorizado.";
        return;
      }
      erro.textContent = registrarFalha(email);
    }
  });
  return true;
}

function iniciarPainel() {
  aplicarIcones();
  const painel = document.querySelector("#modal-admin");
  document.querySelectorAll("[data-tab-trigger]").forEach((aba) => aba.addEventListener("click", () => trocarAba(painel, aba.dataset.tabTrigger)));
  document.querySelector("#btn-sair-admin")?.addEventListener("click", () => sair());
  ouvirEstadoAuth(async (usuario) => {
    if (!usuario || !ehAdmin()) { window.location.replace("/login.html"); return; }
    try { await iniciarPainelAdmin(painel); }
    catch (erro) { registrarErroCliente("iniciar-painel-admin", erro); toast("Não foi possível carregar o painel. Atualize a página e tente novamente.", "error"); }
  });
}

if (!iniciarLogin()) iniciarPainel();
