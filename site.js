/* メニューの開け閉め（左上の3本線）。リンクを押す・Esc・もう一度押すで閉じる */
(function () {
  "use strict";
  var btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  if (!btn || !nav) return;
  function set(open) {
    nav.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
  }
  btn.addEventListener("click", function () { set(nav.hidden); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !nav.hidden) { set(false); btn.focus(); } });
})();
