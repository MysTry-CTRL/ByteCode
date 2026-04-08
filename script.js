const body = document.body;
const bootStatus = document.getElementById("boot-status");
const bootLog = document.getElementById("boot-log");
const bootProgressFill = document.getElementById("boot-progress-fill");
const bootScreen = document.getElementById("boot-screen");
const aboutDropdown = document.querySelector("[data-about-dropdown]");
const aboutTrigger = document.getElementById("about-trigger");
const aboutMenu = document.getElementById("about-menu");
const userCenter = document.querySelector("[data-user-center]");
const userCenterTrigger = document.getElementById("user-center-trigger");
const userCenterMenu = document.getElementById("user-center-menu");
const joinButton = document.getElementById("join-button");
const signOutButton = document.getElementById("sign-out-button");
const themeButtons = document.querySelectorAll("[data-theme-value]");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const themeStorageKey = "bytecode-theme";
const userStateStorageKey = "bytecode-user-state";

const bootSteps = [
  {
    status: "Powering on interface core...",
    log: "Kernel handoff complete",
    progress: 16,
    delay: prefersReducedMotion ? 120 : 480
  },
  {
    status: "Preparing floating top bar...",
    log: "Segment layout mounted",
    progress: 34,
    delay: prefersReducedMotion ? 120 : 560
  },
  {
    status: "Loading navigation systems...",
    log: "Primary routes connected",
    progress: 56,
    delay: prefersReducedMotion ? 120 : 620
  },
  {
    status: "Syncing member controls...",
    log: "Theme and action center online",
    progress: 78,
    delay: prefersReducedMotion ? 120 : 680
  },
  {
    status: "Launching ByteCode header...",
    log: "Interface ready",
    progress: 100,
    delay: prefersReducedMotion ? 140 : 760
  }
];

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

function appendLogLine(message) {
  const item = document.createElement("li");
  item.textContent = `[ OK ] ${message}`;
  bootLog.appendChild(item);
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  body.dataset.theme = nextTheme;
  storeValue(themeStorageKey, nextTheme);

  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeValue === nextTheme;
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setUserState(state) {
  const nextState = state === "member" ? "member" : "guest";
  body.dataset.userState = nextState;
  storeValue(userStateStorageKey, nextState);

  if (nextState === "guest") {
    closeUserCenter();
  }
}

function openAboutMenu() {
  aboutDropdown.classList.add("is-open");
  aboutTrigger.setAttribute("aria-expanded", "true");
}

function closeAboutMenu() {
  aboutDropdown.classList.remove("is-open");
  aboutTrigger.setAttribute("aria-expanded", "false");
}

function openUserCenter() {
  userCenter.classList.add("is-open");
  userCenterTrigger.setAttribute("aria-expanded", "true");
}

function closeUserCenter() {
  userCenter.classList.remove("is-open");
  userCenterTrigger.setAttribute("aria-expanded", "false");
}

function closeAllMenus() {
  closeAboutMenu();
  closeUserCenter();
}

function initializeStoredState() {
  const storedTheme = readStoredValue(themeStorageKey);
  const storedUserState = readStoredValue(userStateStorageKey);

  setTheme(storedTheme || "light");
  setUserState(storedUserState || "guest");
}

function completeBoot() {
  body.classList.add("boot-complete");

  window.setTimeout(() => {
    body.classList.add("topbar-live");
  }, prefersReducedMotion ? 0 : 180);

  window.setTimeout(() => {
    body.classList.add("brand-condensed");
  }, prefersReducedMotion ? 0 : 2800);

  window.setTimeout(() => {
    bootScreen.setAttribute("aria-hidden", "true");
  }, prefersReducedMotion ? 40 : 900);
}

function runBootSequence(index = 0) {
  if (index >= bootSteps.length) {
    completeBoot();
    return;
  }

  const step = bootSteps[index];
  bootStatus.textContent = step.status;
  bootProgressFill.style.width = `${step.progress}%`;
  appendLogLine(step.log);

  window.setTimeout(() => {
    runBootSequence(index + 1);
  }, step.delay);
}

function setupMenus() {
  aboutTrigger.addEventListener("click", () => {
    const isOpen = aboutDropdown.classList.contains("is-open");
    closeAllMenus();

    if (!isOpen) {
      openAboutMenu();
    }
  });

  userCenterTrigger.addEventListener("click", () => {
    const isOpen = userCenter.classList.contains("is-open");
    closeAllMenus();

    if (!isOpen) {
      openUserCenter();
    }
  });

  if (hoverCapable) {
    aboutDropdown.addEventListener("mouseenter", openAboutMenu);
    aboutDropdown.addEventListener("mouseleave", closeAboutMenu);
  }

  document.addEventListener("click", (event) => {
    if (!aboutDropdown.contains(event.target) && !userCenter.contains(event.target)) {
      closeAllMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllMenus();
    }
  });

  aboutMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeAboutMenu);
  });

  userCenterMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeUserCenter);
  });
}

function setupControls() {
  joinButton.addEventListener("click", () => {
    setUserState("member");
  });

  signOutButton.addEventListener("click", () => {
    setUserState("guest");
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.themeValue);
    });
  });
}

window.addEventListener("load", () => {
  initializeStoredState();
  setupMenus();
  setupControls();

  bootProgressFill.style.width = "6%";
  window.setTimeout(() => {
    runBootSequence();
  }, prefersReducedMotion ? 20 : 280);
});
