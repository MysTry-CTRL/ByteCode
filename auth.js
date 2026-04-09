import { auth, db, githubProvider, googleProvider, isDefaultAdminEmail } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile
} from "./node_modules/firebase/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc
} from "./node_modules/firebase/firebase-firestore.js";

const themeStorageKey = "bytecode-theme";
const userRoleStorageKey = "bytecode-user-role";
const userStateStorageKey = "bytecode-user-state";
const authWindow = document.querySelector(".auth-window");
const authModeButtons = document.querySelectorAll("[data-auth-switch]");
const authPanels = document.querySelectorAll("[data-auth-panel]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authArtPanels = document.querySelectorAll("[data-auth-art]");
const providerButtons = document.querySelectorAll("[data-auth-provider]");
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");
const themeColorMeta = document.getElementById("theme-color-meta");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const feedbackByMode = {
  login: document.getElementById("auth-feedback-login"),
  register: document.getElementById("auth-feedback-register")
};

let recaptchaVerifier;
let authReady = false;

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
  const nextTheme = storedTheme || "dark";
  document.body.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", nextTheme === "light" ? "#f5f8ff" : "#050914");
  }
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

function setFeedback(mode, message = "", state = "") {
  const panel = feedbackByMode[mode];

  if (!panel) {
    return;
  }

  panel.textContent = message;

  if (state) {
    panel.dataset.state = state;
  } else {
    delete panel.dataset.state;
  }
}

function clearFeedback() {
  Object.keys(feedbackByMode).forEach((mode) => {
    setFeedback(mode);
  });
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
  clearFeedback();
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

function setPending(mode, isPending) {
  const form = mode === "register" ? registerForm : loginForm;

  if (!form) {
    return;
  }

  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = isPending;
  });

  providerButtons.forEach((button) => {
    button.disabled = isPending;
  });
}

function normaliseMessage(error) {
  const message = error?.message || "Authentication failed. Please try again.";

  if (message.includes("auth/email-already-in-use")) {
    return "That email is already in use. Try logging in instead.";
  }

  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
    return "The email or password looks incorrect.";
  }

  if (message.includes("auth/popup-closed-by-user")) {
    return "The sign-in popup was closed before completion.";
  }

  if (message.includes("auth/account-exists-with-different-credential")) {
    return "An account already exists with a different sign-in method.";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "This sign-in method is not enabled in Firebase yet.";
  }

  if (message.includes("auth/invalid-phone-number")) {
    return "Enter a valid phone number including the country code.";
  }

  if (message.includes("auth/invalid-verification-code")) {
    return "The verification code is invalid or expired.";
  }

  return message.replace(/^Firebase:\s*/i, "");
}

function collectClientContext() {
  return {
    language: navigator.language || null,
    languages: Array.isArray(navigator.languages) ? navigator.languages.slice(0, 5) : [],
    platform: navigator.userAgentData?.platform || navigator.platform || null,
    theme: document.body.dataset.theme || "dark",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    url: window.location.href,
    userAgent: navigator.userAgent || null
  };
}

function serialiseProviderData(user) {
  return (user.providerData || []).map((provider) => ({
    providerId: provider.providerId || null,
    uid: provider.uid || null,
    email: provider.email || null,
    phoneNumber: provider.phoneNumber || null,
    displayName: provider.displayName || null
  }));
}

async function ensureUserProfile(user, extraData = {}) {
  const userRef = doc(db, "users", user.uid);
  const userEventsRef = collection(db, "users", user.uid, "authEvents");
  const isDefaultAdmin = isDefaultAdminEmail(user.email || extraData.email);
  const clientContext = collectClientContext();
  const profileData = {
    uid: user.uid,
    email: user.email || extraData.email || null,
    emailVerified: Boolean(user.emailVerified),
    phoneNumber: user.phoneNumber || extraData.phoneNumber || null,
    displayName: extraData.displayName || user.displayName || null,
    providerId: extraData.providerId || user.providerData?.[0]?.providerId || null,
    providerIds: (user.providerData || []).map((provider) => provider.providerId),
    providerProfiles: serialiseProviderData(user),
    photoURL: user.photoURL || null,
    isAnonymous: Boolean(user.isAnonymous),
    defaultAdminCandidate: isDefaultAdmin,
    authFlow: extraData.authFlow || "sign-in",
    loginCount: increment(1),
    authCreatedAt: user.metadata?.creationTime || null,
    authLastSignInAt: user.metadata?.lastSignInTime || null,
    lastSeenTheme: clientContext.theme,
    lastSeenLanguage: clientContext.language,
    lastSeenTimezone: clientContext.timezone,
    lastSeenPlatform: clientContext.platform,
    lastLoginAt: serverTimestamp()
  };

  if (extraData.createdAt) {
    profileData.createdAt = extraData.createdAt;
  }

  const authEvent = {
    type: extraData.authFlow || "sign-in",
    providerId: extraData.providerId || user.providerData?.[0]?.providerId || null,
    email: user.email || extraData.email || null,
    phoneNumber: user.phoneNumber || extraData.phoneNumber || null,
    defaultAdminCandidate: isDefaultAdmin,
    createdAt: serverTimestamp(),
    client: clientContext
  };

  await Promise.all([
    setDoc(userRef, profileData, { merge: true }),
    addDoc(userEventsRef, authEvent)
  ]);
}

function finishAuth(delay = 900) {
  storeValue(userStateStorageKey, "member");
  storeValue(userRoleStorageKey, isDefaultAdminEmail(auth.currentUser?.email) ? "admin" : "member");
  window.setTimeout(() => {
    window.location.href = "index.html";
  }, delay);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearFeedback();
  setPending("login", true);

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(credential.user, {
      authFlow: "sign-in",
      email,
      providerId: "password"
    });
    setFeedback("login", "Logged in successfully. Redirecting...", "success");
    finishAuth();
  } catch (error) {
    setFeedback("login", normaliseMessage(error), "error");
  } finally {
    setPending("login", false);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  clearFeedback();
  setPending("register", true);

  const formData = new FormData(registerForm);
  const displayName = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    await ensureUserProfile(credential.user, {
      authFlow: "sign-up",
      createdAt: serverTimestamp(),
      displayName,
      email,
      providerId: "password"
    });

    setFeedback("register", "Account created successfully. Redirecting...", "success");
    finishAuth();
  } catch (error) {
    setFeedback("register", normaliseMessage(error), "error");
  } finally {
    setPending("register", false);
  }
}

async function handleProviderSignIn(providerName) {
  const currentMode = document.body.dataset.authMode === "register" ? "register" : "login";
  clearFeedback();
  setPending(currentMode, true);

  try {
    if (providerName === "phone") {
      await handlePhoneSignIn(currentMode);
      return;
    }

    const provider = providerName === "github" ? githubProvider : googleProvider;
    const credential = await signInWithPopup(auth, provider);
    await ensureUserProfile(credential.user, {
      authFlow: currentMode === "register" ? "social-sign-up" : "social-sign-in",
      providerId: provider.providerId
    });
    setFeedback(currentMode, "Signed in successfully. Redirecting...", "success");
    finishAuth();
  } catch (error) {
    setFeedback(currentMode, normaliseMessage(error), "error");
  } finally {
    setPending(currentMode, false);
  }
}

function getRecaptchaVerifier() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "phone-recaptcha", {
      size: "invisible"
    });
  }

  return recaptchaVerifier;
}

async function handlePhoneSignIn(mode) {
  const phoneNumber = window.prompt("Enter your phone number with country code. Example: +15551234567");

  if (!phoneNumber) {
    throw new Error("Phone sign-in was cancelled.");
  }

  const verifier = getRecaptchaVerifier();
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
  const verificationCode = window.prompt("Enter the verification code sent to your phone.");

  if (!verificationCode) {
    throw new Error("Verification code entry was cancelled.");
  }

  const credential = await confirmation.confirm(verificationCode.trim());
  await ensureUserProfile(credential.user, {
    authFlow: mode === "register" ? "phone-sign-up" : "phone-sign-in",
    phoneNumber: credential.user.phoneNumber,
    providerId: "phone"
  });
  setFeedback(mode, "Phone sign-in successful. Redirecting...", "success");
  finishAuth();
}

function setupProviderButtons() {
  providerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleProviderSignIn(button.dataset.authProvider);
    });
  });
}

function setupPasswordToggles() {
  passwordToggleButtons.forEach((button) => {
    const wrapper = button.closest(".auth-password");
    const input = wrapper?.querySelector("input");
    const label = button.querySelector("[data-password-toggle-label]");

    if (!input || !label) {
      return;
    }

    button.addEventListener("click", () => {
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.setAttribute("aria-pressed", String(shouldShow));
      button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
      label.textContent = shouldShow ? "Hide" : "Show";
    });
  });
}

window.addEventListener("load", () => {
  initializeTheme();
  setAuthMode(readModeFromLocation(), { skipHistory: true });
  setupModeSwitches();
  setupProviderButtons();
  setupPasswordToggles();

  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }

  onAuthStateChanged(auth, (user) => {
    if (!authReady) {
      authReady = true;

      if (user) {
        finishAuth();
      }
    }
  });
});
