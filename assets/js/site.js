const initSiteNav = () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  const submenuToggles = document.querySelectorAll(".submenu-toggle");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      nav.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("nav-open", !isOpen);
    });
  }

  submenuToggles.forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".site-nav__item--has-submenu");
      const isOpen = button.getAttribute("aria-expanded") === "true";
      if (!item) {
        return;
      }
      button.setAttribute("aria-expanded", String(!isOpen));
      item.classList.toggle("is-open", !isOpen);
    });
  });
};

const setFeedbackStatus = (element, message, state = "") => {
  if (!element) {
    return;
  }

  element.textContent = message;

  if (state) {
    element.dataset.state = state;
    return;
  }

  delete element.dataset.state;
};

const setFeedbackFieldsDisabled = (fields, disabled) => {
  fields.forEach((field) => {
    field.disabled = disabled;
  });
};

const getFeedbackTokenField = (form) => form.querySelector('input[name="smart-token"]');

const resetFeedbackCaptcha = (state) => {
  state.token = "";
  const tokenField = getFeedbackTokenField(state.form);

  if (tokenField) {
    tokenField.value = "";
  }

  if (window.smartCaptcha && typeof window.smartCaptcha.reset === "function") {
    window.smartCaptcha.reset();
  }
};

const refreshFeedbackSubmitState = (state) => {
  if (!state.submitButton) {
    return;
  }

  const shouldEnable = state.isConfigured && !state.isSubmitting && Boolean(state.token);
  state.submitButton.disabled = !shouldEnable;
  state.submitButton.textContent = state.isSubmitting ? "Отправка..." : state.defaultButtonLabel;
};

const getFeedbackCaptchaToken = (state) => {
  const tokenField = getFeedbackTokenField(state.form);

  if (tokenField && typeof tokenField.value === "string" && tokenField.value.trim()) {
    return tokenField.value.trim();
  }

  return state.token || "";
};

const buildFeedbackPayload = (form, token) => ({
  feedback_type: String(form.elements.feedback_type?.value || "").trim(),
  name: String(form.elements.name?.value || "").trim(),
  message: String(form.elements.message?.value || "").trim(),
  smart_token: token,
  page_url: window.location.href,
  page_path: window.location.pathname
});

const initFeedbackCounters = () => {
  const feedbackMessages = document.querySelectorAll("[data-feedback-message]");

  feedbackMessages.forEach((field) => {
    const wrapper = field.closest(".feedback-field");
    const counter = wrapper ? wrapper.querySelector("[data-feedback-counter]") : null;
    const maxLength = Number(field.getAttribute("maxlength")) || 0;

    if (!counter || !maxLength) {
      return;
    }

    const updateCounter = () => {
      counter.textContent = `${field.value.length} / ${maxLength}`;
    };

    updateCounter();
    field.addEventListener("input", updateCounter);
    field.addEventListener("keyup", updateCounter);
    field.addEventListener("change", updateCounter);
  });
};

const initFeedbackForms = () => {
  const forms = document.querySelectorAll("[data-feedback-form]");

  forms.forEach((form) => {
    const fields = Array.from(form.querySelectorAll("[data-feedback-field]"));
    const status = form.querySelector("[data-feedback-status]");
    const submitButton = form.querySelector("[data-feedback-submit]");
    const endpoint = String(form.dataset.feedbackEndpoint || "").trim();
    const sitekey = String(form.dataset.smartcaptchaSitekey || "").trim();
    const successUrl = String(form.dataset.feedbackSuccessUrl || "/feedback-submitted.html").trim();

    const state = {
      defaultButtonLabel: submitButton ? submitButton.textContent : "",
      endpoint,
      fields,
      form,
      isConfigured: Boolean(endpoint && sitekey),
      isSubmitting: false,
      sitekey,
      status,
      submitButton,
      successUrl,
      token: ""
    };

    form.__feedbackState = state;

    if (!state.isConfigured) {
      setFeedbackFieldsDisabled(state.fields, true);
      refreshFeedbackSubmitState(state);
      setFeedbackStatus(state.status, "Форма временно недоступна: отсутствует конфигурация Yandex Cloud.", "error");
      return;
    }

    setFeedbackFieldsDisabled(state.fields, false);
    state.token = getFeedbackCaptchaToken(state);
    refreshFeedbackSubmitState(state);
    setFeedbackStatus(state.status, "Подтвердите, что вы не робот, чтобы отправить отзыв.", "muted");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const token = getFeedbackCaptchaToken(state);

      if (!token) {
        setFeedbackStatus(state.status, "Сначала подтвердите, что вы не робот.", "error");
        refreshFeedbackSubmitState(state);
        return;
      }

      state.token = token;

      if (!form.reportValidity()) {
        return;
      }

      state.isSubmitting = true;
      refreshFeedbackSubmitState(state);
      setFeedbackStatus(state.status, "Отправляем отзыв на модерацию...", "muted");

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), 15000) : null;

      try {
        const response = await fetch(state.endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildFeedbackPayload(form, token)),
          signal: controller ? controller.signal : undefined
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        if (!response.ok || data.status !== "ok") {
          throw new Error(data.message || "feedback-submit-failed");
        }

        window.location.assign(state.successUrl);
      } catch (error) {
        resetFeedbackCaptcha(state);
        state.token = "";

        if (error.name === "AbortError") {
          setFeedbackStatus(state.status, "Сервер не ответил вовремя. Попробуйте еще раз.", "error");
        } else {
          setFeedbackStatus(state.status, "Не удалось отправить отзыв. Повторите попытку немного позже.", "error");
        }
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }

        state.isSubmitting = false;
        refreshFeedbackSubmitState(state);
      }
    });
  });
};

window.onFeedbackCaptchaSuccess = (token) => {
  const form = document.querySelector("[data-feedback-form]");

  if (!form || !form.__feedbackState) {
    return;
  }

  const state = form.__feedbackState;
  state.token = String(token || "").trim();
  const tokenField = getFeedbackTokenField(form);

  if (tokenField) {
    tokenField.value = state.token;
  }

  refreshFeedbackSubmitState(state);

  if (state.token) {
    setFeedbackStatus(state.status, "Проверка пройдена. Отзыв можно отправить.", "success");
    return;
  }

  setFeedbackStatus(state.status, "Подтвердите, что вы не робот, чтобы отправить отзыв.", "muted");
};

const initPage = () => {
  initSiteNav();
  initFeedbackCounters();
  initFeedbackForms();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
