// SPDX-License-Identifier: MIT
// Copyright (c) 2025-2026 Robworks Software LLC
//
// Syncs the Giscus iframe theme with MkDocs Material's light/dark toggle.

(function () {
  function getGiscusTheme() {
    var scheme = document.body.getAttribute("data-md-color-scheme");
    return scheme === "slate" ? "dark" : "light";
  }

  function setGiscusTheme(theme) {
    var iframe = document.querySelector("iframe.giscus-frame");
    if (!iframe) return;
    iframe.contentWindow.postMessage(
      { giscus: { setConfig: { theme: theme } } },
      "https://giscus.app"
    );
  }

  // Observe scheme changes on <body>
  var observer = new MutationObserver(function () {
    setGiscusTheme(getGiscusTheme());
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });

  // Set initial theme once iframe loads
  window.addEventListener("message", function (event) {
    if (event.origin !== "https://giscus.app") return;
    if (!(typeof event.data === "object" && event.data.giscus)) return;
    setGiscusTheme(getGiscusTheme());
  });
})();
