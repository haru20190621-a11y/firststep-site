/* 体験予約のフォーム（GymKeep につなぐ）。
   index.html の <section id="trial" data-booking-url="..."> に、GymKeep の「体験予約」の画面でコピーした
   予約ページの URL（https://…/t/<予約用の番号>）を1つ入れるだけで動く。
   - 空き枠は GymKeep から読む（/t/<番号>/slots.json）。予約は /t/<番号>/book に送る（Cookie は送らない）
   - 予約はそのままオーナーの GymKeep の「体験予約」に入り、オーナーにメールが届く
   - 予約のあと、GymKeep が返す「ジムとのメッセージ」のページ（chat_url・予約ごとの合言葉つき）への入口を出す。
     GymKeep は予約を受けた時点で、入れたメールアドレスに「受け付けました」を送る（返事の mailed が true のときだけ、画面で案内する）。
     メールアドレスは、ジムの返事が届いた知らせの宛先として GymKeep に渡す（2026-11-26）
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
  var doneChat = $("[data-done-chat]"), doneChatLink = $("[data-done-chat-link]"), doneMail = $("[data-done-mail]");
  var confirmBox = $("[data-confirm]"), confirmSend = $("[data-confirm-send]"), confirmEdit = $("[data-confirm-edit]");

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
    // 電話番号は途中で折り返さない（ひとまとまりの span に入れる）。文字は textContent で入れる
    fallbackText.textContent = "";
    var parts = phone ? text.split(phone) : [text];
    parts.forEach(function (part, i) {
      if (i > 0) {
        var tel = document.createElement("span");
        tel.className = "nowrap"; tel.textContent = phone;
        fallbackText.appendChild(tel);
      }
      fallbackText.appendChild(document.createTextNode(part));
    });
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

  // 日時は「日にち」と「時間」の2つの選ぶ欄（GymKeep は営業時間から30分ごと・1か月先まで出すので、並べると長くなる）。
  // left は残りの人数。null は定員なし（2026-11-02〜）。0 の時間は出さない
  var openSlot = function (s) { return s.left === null || s.left === undefined || s.left > 0; };
  var daySel, timeSel;

  function option(sel, value, text) {
    var o = document.createElement("option");
    o.value = value; o.textContent = text;
    sel.appendChild(o);
  }

  function field(id, text, sel) {
    var lab = document.createElement("label");
    lab.htmlFor = id; lab.textContent = text;
    sel.id = id;
    slotsBox.appendChild(lab);
    slotsBox.appendChild(sel);
  }

  function renderSlots(days) {
    slotsBox.textContent = "";
    daySel = document.createElement("select");
    timeSel = document.createElement("select");
    field("bDay", "日にち", daySel);
    field("bTime", "時間", timeSel);
    var byDate = {};
    option(daySel, "", "選んでください");
    days.forEach(function (d) {
      var times = d.slots.filter(openSlot).map(function (s) { return s.time; });
      if (!times.length) return;
      byDate[d.date] = times;
      option(daySel, d.date, d.label);
    });
    function fillTimes() {
      timeSel.textContent = "";
      var times = byDate[daySel.value] || [];
      option(timeSel, "", times.length ? "選んでください" : "先に日にちを選んでください");
      times.forEach(function (t) { option(timeSel, t, t); });
      timeSel.disabled = !times.length;
    }
    daySel.addEventListener("change", fillTimes);
    fillTimes();
  }

  function load() {
    fetch(base + "/t/" + key + "/slots.json", { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var lines = [];
        if (data.fee) lines.push("体験の費用：" + data.fee);
        if (data.note) lines.push("持ち物：" + data.note);
        if (lines.length) { note.textContent = lines.join("\n"); show(note, true); }
        var contact = phone ? "（" + phone + "）" : "";
        if (!data.ok || !data.open) {
          giveUp("いまはネットでの体験予約を受け付けていません。お手数ですが、お電話でお問い合わせください" + contact + "。", false);
          return;
        }
        var open = (data.days || []).filter(function (d) { return d.slots.some(openSlot); });
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
    var day = daySel ? daySel.value : "", time = timeSel ? timeSel.value : "";
    var mail = String(fd.get("email") || "").trim();      // ジムから返事が届いた知らせの宛先（GymKeep は「来た」で消す）
    var problem = !day ? "日にちを選んでください" : !time ? "時間を選んでください"
      : !String(fd.get("name") || "").trim() ? "お名前を入れてください"
      : !String(fd.get("phone") || "").trim() ? "電話番号を入れてください"
      : !mail ? "メールアドレスを入れてください"
      : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) ? "メールアドレスの形が違うようです。入れ直してください"
      : !fd.get("agree") ? "同意のチェックを入れてください" : "";
    if (problem) { errorBox.textContent = problem; show(errorBox, true); return; }
    var body = new URLSearchParams();
    body.set("date", day); body.set("time", time);
    ["name", "phone", "age", "sex", "note", "agree", "website"].forEach(function (k) { body.set(k, fd.get(k) || ""); });
    body.set("email", mail);
    // 送る前に、入れた内容を1回見てもらう（2026-11-26）。電話番号は当日の受付で照らすので、打ち間違いにここで気づけるように
    pending = body;
    setConfirm("when", daySel.options[daySel.selectedIndex].textContent + " " + time);
    setConfirm("name", String(fd.get("name")).trim());
    setConfirm("phone", String(fd.get("phone")).trim());
    setConfirm("email", mail);
    show(form, false);
    show(confirmBox, true);
    confirmBox.scrollIntoView({ block: "center" });
  });

  var pending = null;                            // 確認の画面で「予約する」を押したときに送る中身
  function setConfirm(name, text) { confirmBox.querySelector('[data-confirm-' + name + ']').textContent = text; }

  function backToForm(message) {                 // 直すとき・送れなかったときは、入れた内容を残したままフォームに戻す
    show(confirmBox, false);
    show(form, true);
    if (message) { errorBox.textContent = message; show(errorBox, true); errorBox.scrollIntoView({ block: "center" }); }
  }

  confirmEdit.addEventListener("click", function () { backToForm(""); form.scrollIntoView({ block: "start" }); });

  confirmSend.addEventListener("click", function () {
    if (!pending) return;
    confirmSend.disabled = true;
    fetch(base + "/t/" + key + "/book", {
      method: "POST", body: pending, credentials: "omit", headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.j.ok) {
          doneWhen.textContent = res.j.label || "";
          // ジムとのメッセージの入口（予約ごとの合言葉つきの URL）。http(s) のときだけリンクにする
          var chat = String(res.j.chat_url || "");
          if (doneChat && /^https?:\/\//.test(chat)) { doneChatLink.href = chat; show(doneChat, true); }
          // GymKeep が「受け付けました」のメールを送れたときだけ、その案内を出す（2026-11-26。送れなかったとき・古い返事では出さない）
          if (doneMail) show(doneMail, res.j.mailed === true);
          pending = null;
          show(confirmBox, false);
          show(done, true);
          done.scrollIntoView({ block: "center" });
          return;
        }
        backToForm(res.j.error || "予約できませんでした。もう一度お試しください。");
        if (res.status === 409) load();          // 満員になった枠を出し直す（入力した名前などはそのまま）
      })
      .catch(function () {
        backToForm("通信できませんでした。電波の良いところで、もう一度お試しください。");
      })
      .then(function () { confirmSend.disabled = false; });
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
