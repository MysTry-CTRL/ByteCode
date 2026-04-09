const themeStorageKey = "bytecode-theme";
const userStateStorageKey = "bytecode-user-state";
const authWindow = document.querySelector(".auth-window");
const authModeButtons = document.querySelectorAll("[data-auth-switch]");
const authPanels = document.querySelectorAll("[data-auth-panel]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authArtPanels = document.querySelectorAll("[data-auth-art]");

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    return;
  }
}

function initializeTheme() {
  const storedTheme = readStoredValue(themeStorageKey);
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.dataset.theme = storedTheme || (systemPrefersDark ? "dark" : "light");
}

function readModeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "register" ? "register" : "login";
}

function updateHistory(mode) {
  const url = new URL(window.location.href);

  if (mode === "register") {
    url.searchParams.set("mode", "register");
  } else {
    url.searchParams.delete("mode");
  }

  window.history.replaceState({ mode }, "", url);
}

function updateAccessibility(mode) {
  authPanels.forEach((panel) => {
    panel.setAttribute("aria-hidden", String(panel.dataset.authPanel !== mode));
  });

  authForms.forEach((form) => {
    const isActive = form.dataset.authForm === mode;
    form.setAttribute("aria-hidden", String(!isActive));

    form.querySelectorAll("input, button").forEach((element) => {
      element.tabIndex = isActive ? 0 : -1;

      if ("disabled" in element) {
        element.disabled = !isActive;
      }
    });
  });

  authArtPanels.forEach((panel) => {
    panel.setAttribute("aria-hidden", String(panel.dataset.authArt !== mode));
  });

  if (authWindow) {
    authWindow.setAttribute("aria-label", mode === "register" ? "Registration window" : "Login window");
  }
}

function setAuthMode(mode, options = {}) {
  const nextMode = mode === "register" ? "register" : "login";
  document.body.dataset.authMode = nextMode;
  document.body.dataset.authSwitching = "true";
  document.title = nextMode === "register" ? "Register | ByteCode" : "Log in | ByteCode";
  updateAccessibility(nextMode);

  if (!options.skipHistory) {
    updateHistory(nextMode);
  }

  window.clearTimeout(setAuthMode.switchTimer);
  setAuthMode.switchTimer = window.setTimeout(() => {
    document.body.dataset.authSwitching = "false";
  }, 460);
}

function setupModeSwitches() {
  authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authSwitch);
    });
  });

  window.addEventListener("popstate", () => {
    setAuthMode(readModeFromLocation(), { skipHistory: true });
  });
}

function finishAuth() {
  storeValue(userStateStorageKey, "member");
  window.location.href = "index.html";
}

window.addEventListener("load", () => {
  initializeTheme();
  setAuthMode(readModeFromLocation(), { skipHistory: true });
  setupModeSwitches();

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      finishAuth();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      finishAuth();
    });
  }
});
