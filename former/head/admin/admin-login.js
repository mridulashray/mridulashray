const loginForm = document.getElementById("admin-login-form");
const feedbackEl = document.getElementById("admin-login-feedback");
const SESSION_KEY = "mridulashrayAdminSession";
const TAB_SESSION_FLAG = "mridulashrayAdminTabFlag";

const account = window.appwrite?.account;

const setFeedback = (message, isError = false) => {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.classList.toggle("is-error", isError);
};

const startTabSession = () => {
  try {
    sessionStorage.setItem(TAB_SESSION_FLAG, "1");
  } catch {
    // ignore sessionStorage errors
  }
};

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFeedback("Validating credentials…");

  if (!account) {
    setFeedback("Appwrite SDK not ready. Check script order.", true);
    return;
  }

  const formData = new FormData(loginForm);
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    setFeedback("Please enter both email and password.", true);
    return;
  }

  try {
    try {
      await account.deleteSessions();
    } catch {
      // ignore – safe to proceed
    }
    await account.createEmailSession(email, password);
    const current = await account.get();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: current.email,
        ts: Date.now()
      })
    );
    setFeedback("Login successful. Redirecting…");
    startTabSession();
    window.location.href = "./dashboard.html";
  } catch (error) {
    console.error(error);
    setFeedback(error?.message || "Login failed. Please verify credentials.", true);
  }
});

