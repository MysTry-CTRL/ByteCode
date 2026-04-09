import { auth, isDefaultAdminEmail } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "./node_modules/firebase/firebase-auth.js";

const body = document.body;
const aboutDropdown = document.querySelector("[data-about-dropdown]");
const aboutTrigger = document.getElementById("about-trigger");
const aboutMenu = document.getElementById("about-menu");
const userCenter = document.querySelector("[data-user-center]");
const userCenterTrigger = document.getElementById("user-center-trigger");
const userCenterMenu = document.getElementById("user-center-menu");
const joinButton = document.getElementById("join-button");
const signOutButton = document.getElementById("sign-out-button");
const themeButtons = document.querySelectorAll("[data-theme-value]");
const themeColorMeta = document.getElementById("theme-color-meta");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const themeStorageKey = "bytecode-theme";
const userRoleStorageKey = "bytecode-user-role";
const userStateStorageKey = "bytecode-user-state";

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

function syncBrowserTheme(theme) {
  document.documentElement.style.colorScheme = theme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", theme === "light" ? "#f5f8ff" : "#050914");
  }
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  body.dataset.theme = nextTheme;
  storeValue(themeStorageKey, nextTheme);
  syncBrowserTheme(nextTheme);

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

function setUserRole(role) {
  const nextRole = role === "admin" ? "admin" : role === "member" ? "member" : "guest";
  body.dataset.userRole = nextRole;
  storeValue(userRoleStorageKey, nextRole);
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
  setTheme(storedTheme || "dark");
  setUserState("guest");
  setUserRole("guest");
}

function scheduleBrandCondense() {
  body.classList.remove("brand-condensed");

  window.setTimeout(() => {
    body.classList.add("brand-condensed");
  }, prefersReducedMotion ? 0 : 1900);
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
    window.location.href = "login.html?mode=login";
  });

  signOutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      setUserState("guest");
      setUserRole("guest");
    } catch (error) {
      console.error("Unable to sign out:", error);
    }
  });

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.themeValue);
    });
  });
}

function setupAuthState() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      setUserState("guest");
      setUserRole("guest");
      return;
    }

    setUserState("member");
    setUserRole(isDefaultAdminEmail(user.email) ? "admin" : "member");
  });
}

window.addEventListener("load", () => {
  initializeStoredState();
  setupMenus();
  setupControls();
  setupAuthState();
  scheduleBrandCondense();
});
