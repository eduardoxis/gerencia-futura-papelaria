import { ouvirEstadoAuth, ehAdmin, entrar, sair } from "./services/auth.js";
import { iniciarPainelAdmin } from "./modules/dashboard.js";
import { iniciarLoadingGlobal } from "./utils/loadingUI.js";
import { podeExecutar, registrarErroCliente, toast } from "./utils/utils.js";
import { trocarAba } from "./utils/modal.js";
import { ICONS } from "./utils/icons.js";

iniciarLoadingGlobal();

function aplicarIcones() {
  document.querySelectorAll("[data-icon]").forEach((elemento) => {
    const nome = elemento.dataset.icon;
    if (ICONS[nome]) elemento.innerHTML = ICONS[nome];
  });
}

function mostrarLogin(mensagem = "") {
  const telaLogin = document.querySelector("#tela-login");
  const painel = document.querySelector("#modal-admin");
  const erro = document.querySelector("#erro-login-admin");
  telaLogin.hidden = false;
  painel.hidden = true;
  painel.classList.remove("is-open");
  if (erro) erro.textContent = mensagem;
}

function mostrarPainel() {
  document.querySelector("#tela-login").hidden = true;
  const painel = document.querySelector("#modal-admin");
  painel.hidden = false;
  painel.classList.add("is-open");
}

function configurarLogin() {
  const formulario = document.querySelector("#form-login-admin");
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const erro = document.querySelector("#erro-login-admin");
    erro.textContent = "";
    const email = formulario.email.value.trim();
    if (!podeExecutar(`login-admin:${email.toLowerCase()}`, 5, 60_000)) {
      erro.textContent = "Muitas tentativas. Aguarde um minuto e tente novamente.";
      return;
    }
    try {
      await entrar(email, formulario.senha.value, formulario.manterLogin.checked);
    } catch {
      erro.textContent = "Não foi possível entrar. Verifique os dados informados.";
    }
  });
}

function configurarNavegacao(painel) {
  document.querySelectorAll("[data-tab-trigger]").forEach((aba) => {
    aba.addEventListener("click", () => trocarAba(painel, aba.dataset.tabTrigger));
  });
  document.querySelector("#btn-sair-admin")?.addEventListener("click", () => sair());
}

let painelIniciado = false;
async function iniciar() {
  aplicarIcones();
  configurarLogin();
  const painel = document.querySelector("#modal-admin");
  configurarNavegacao(painel);
  ouvirEstadoAuth(async (usuario) => {
    if (!usuario) return mostrarLogin();
    if (!ehAdmin()) return mostrarLogin("Este usuário não possui permissão para acessar a gerência.");
    mostrarPainel();
    if (painelIniciado) return;
    painelIniciado = true;
    try {
      await iniciarPainelAdmin(painel);
    } catch (erro) {
      painelIniciado = false;
      registrarErroCliente("iniciar-painel-admin", erro);
      toast("Não foi possível carregar o painel. Atualize a página e tente novamente.", "error");
    }
  });
}

iniciar();
