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

const initPage = () => {
  initSiteNav();
  initFeedbackCounters();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
