/* 体験予約のフォーム（GymKeep につなぐ）。
   index.html の <section id="trial" data-booking-url="..."> に、GymKeep の「体験予約」の画面でコピーした
   予約ページの URL（https://…/t/<予約用の番号>）を1つ入れるだけで動く。
   - 空き枠は GymKeep から読む（/t/<番号>/slots.json）。予約は /t/<番号>/book に送る（Cookie は送らない）
   - 予約はそのままオーナーの GymKeep の「体験予約」に入り、オーナーにメールが届く
   - 読み込めないとき・受付を止めているときは、GymKeep の予約ページへのリンクと案内を出す
   - 画面に入れる文字はすべて textContent で入れる（HTML として解釈しない） */
(function () {
  "use strict";
  var root = document.getElementById("trial");
  if (!root) return;
  var $ = function (sel) { return root.querySelector(sel); };
  var form = $("[data-form]"), slotsBox = $("[data-slots]"), loading = $("[data-loading]");
  var fallback = $("[data-fallback]"), fallbackText = $("[data-fallback-text]"), fallbackLink = $("[data-fallback-link]");
  var note = $("[data-note]"), errorBox = $("[data-error]"), done = $("[data-done]"), doneWhen = $("[data-done-when]");
  var submit = form.querySelector("button[type=submit]");

  var url = (root.getAttribute("data-booking-url") || "").trim().replace(/\/+$/, "");
  var phone = (root.getAttribute("data-phone") || "").trim();
  var byPhone = phone ? "お電話（" + phone + "）" : "お電話";
  var m = url.match(/^(https?:\/\/[^\/?#]+)\/t\/([A-Za-z0-9_-]{8,40})$/);

  function show(el, on) { el.hidden = !on; }

  var lead = root.querySelector(".head .lead");

  function giveUp(text, withLink) {
    show(loading, false);
    show(form, false);
    if (lead) show(lead, false);                 // 「日時を選んで…」はフォームが無いときは出さない
    fallbackText.textContent = text;
    if (withLink && m) {
      fallbackLink.href = url; fallbackLink.textContent = "予約ページを開く"; show(fallbackLink, true);
    } else if (phone) {
      fallbackLink.href = "tel:" + phone; fallbackLink.textContent = "電話する"; show(fallbackLink, true);
    }
    show(fallback, true);
  }

  if (!m) {
    giveUp("ネットでのご予約は準備中です。見学・体験のご予約は" + byPhone + "でお願いします。", false);
    return;
  }
  var base = m[1], key = m[2];
  var terms = root.querySelector("[data-terms]");
  if (terms) terms.href = base + "/terms";

  function renderSlots(days) {
    slotsBox.textContent = "";
    days.forEach(function (d) {
      var fs = document.createElement("fieldset");
      fs.className = "day";
      var lg = document.createElement("legend");
      lg.textContent = d.label;
      fs.appendChild(lg);
      var row = document.createElement("div");
      row.className = "slots";
      d.slots.forEach(function (s) {
        var lab = document.createElement("label");
        lab.className = "slot" + (s.left ? "" : " full");
        var r = document.createElement("input");
        r.type = "radio"; r.name = "slot"; r.value = d.date + "|" + s.time; r.disabled = !s.left; r.required = true;
        var t = document.createElement("span");
        t.textContent = s.time;
        var left = document.createElement("small");
        left.textContent = s.left ? "残り" + s.left : "満員";
        lab.appendChild(r); lab.appendChild(t); lab.appendChild(left);
        row.appendChild(lab);
      });
      fs.appendChild(row);
      slotsBox.appendChild(fs);
    });
  }

  function load() {
    fetch(base + "/t/" + key + "/slots.json", { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.note) { note.textContent = data.note; show(note, true); }
        var contact = data.contact ? "（" + data.contact + "）" : "";
        if (!data.ok || !data.open) {
          giveUp("いまはネットでの体験予約を受け付けていません。お手数ですが、お電話でお問い合わせください" + contact + "。", false);
          return;
        }
        var open = (data.days || []).filter(function (d) { return d.slots.some(function (s) { return s.left > 0; }); });
        if (!open.length) {
          giveUp("いま予約できる日時がありません。お手数ですが、お電話でお問い合わせください" + contact + "。", false);
          return;
        }
        renderSlots(data.days);
        show(loading, false);
        show(fallback, false);
        show(form, true);
      })
      .catch(function () {
        giveUp("予約の空き状況を読み込めませんでした。下のボタンの予約ページから申し込めます。", true);
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    show(errorBox, false);
    var fd = new FormData(form);
    var slot = fd.get("slot") || "";
    var problem = !slot ? "日時を選んでください"
      : !String(fd.get("name") || "").trim() ? "お名前を入れてください"
      : !String(fd.get("phone") || "").trim() ? "電話番号を入れてください"
      : !fd.get("agree") ? "同意のチェックを入れてください" : "";
    if (problem) { errorBox.textContent = problem; show(errorBox, true); return; }
    var body = new URLSearchParams();
    var parts = String(slot).split("|");
    body.set("date", parts[0]); body.set("time", parts[1] || "");
    ["name", "phone", "age", "sex", "note", "agree", "website"].forEach(function (k) { body.set(k, fd.get(k) || ""); });
    submit.disabled = true;
    fetch(base + "/t/" + key + "/book", {
      method: "POST", body: body, credentials: "omit", headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.j.ok) {
          doneWhen.textContent = res.j.label || "";
          show(form, false);
          show(done, true);
          done.scrollIntoView({ block: "center" });
          return;
        }
        errorBox.textContent = res.j.error || "予約できませんでした。もう一度お試しください。";
        show(errorBox, true);
        if (res.status === 409) load();          // 満員になった枠を出し直す（入力した名前などはそのまま）
      })
      .catch(function () {
        errorBox.textContent = "通信できませんでした。電波の良いところで、もう一度お試しください。";
        show(errorBox, true);
      })
      .then(function () { submit.disabled = false; });
  });

  // 浮いている丸い「体験予約」は、予約フォームが見えている間は隠す（ボタンが入力欄に重ならないように）
  var sticky = document.querySelector(".float-cta");
  if (sticky && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (x) { sticky.classList.toggle("hide", x.isIntersecting); });
    }).observe(root);
  }

  load();
})();
