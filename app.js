// ===== Cấu hình Firebase cho Web (Compat Version) =====
const firebaseConfig = {
  apiKey: "AIzaSyDhA4lv_e1Qllp4WX9eYdoHaqvOx1WbOEc",
  authDomain: "webtest-16a43.firebaseapp.com",
  projectId: "webtest-16a43",
  storageBucket: "webtest-16a43.firebasestorage.app",
  messagingSenderId: "765163304650",
  appId: "1:765163304650:web:4b042583e2d2ad0f78a633",
  measurementId: "G-95E2KXE286"
};

// Khởi tạo Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const dbFirestore = firebase.firestore();

// ===== Cấu hình ứng dụng =====
const ADMIN = { user: "admin", pass: "admin123" };
let db = { subjects: [], users: [], results: [], progress: [], banner: "", bgColor: "#fff7dc" };
let me = JSON.parse(sessionStorage.getItem("me") || "null");
let timerId = null;

const $ = s => document.querySelector(s);
const app = $("#app");
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = t => new Date(t).toLocaleString("vi-VN");
const subj = id => db.subjects.find(s => s.id === id);
function ytId(u) { const m = String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m && m[1]; }

// Áp dụng màu nền
function applyBgColor() {
  if (db.bgColor) {
    document.documentElement.style.setProperty('--bg', db.bgColor);
  }
}

const cfgDoc = () => dbFirestore.collection("system").doc("config");
const FV = () => firebase.firestore.FieldValue;
const fail = e => { console.error(e); alert("Không lưu được lên Firebase. Kiểm tra mạng và Rules của Firestore."); };

// Tải dữ liệu mới nhất từ Firestore
async function sync() {
  try {
    const d = await cfgDoc().get();
    if (d.exists) db = { ...db, ...d.data() }; else await cfgDoc().set(db);
  } catch (e) { console.error("Lỗi tải dữ liệu:", e); }
  applyBgColor();
}
// Admin: lưu nguyên các trường (môn học, banner, màu nền)
async function save(...keys) {
  const o = {}; keys.forEach(k => o[k] = db[k]);
  try { await cfgDoc().set(o, { merge: true }); } catch (e) { fail(e); }
}
// Học sinh: thêm/xóa 1 phần tử, không ghi đè dữ liệu của người khác
async function addTo(key, item) {
  db[key].push(item);
  try { await cfgDoc().set({ [key]: FV().arrayUnion(item) }, { merge: true }); } catch (e) { fail(e); }
}
async function removeFrom(key, item) {
  const i = db[key].indexOf(item); if (i >= 0) db[key].splice(i, 1);
  try { await cfgDoc().set({ [key]: FV().arrayRemove(item) }, { merge: true }); } catch (e) { fail(e); }
}
async function loadDataFromCloud() {
  app.innerHTML = '<p class="mute" style="text-align:center">Đang tải dữ liệu...</p>';
  if (me) return home();
  await sync(); viewLogin();
}

// ===== Đánh giá học lực =====
function getAcademicEval(username) {
  const userResults = db.results.filter(r => r.user === username);
  if (!userResults.length) return { level: "Chưa đánh giá", color: "#6b7280", pct: 0, text: "Chưa làm bài kiểm tra nào để đánh giá." };
  
  let totalScore = 0, maxScore = 0;
  const allExams = db.subjects.flatMap(s => s.exams);
  
  userResults.forEach(r => {
    const e = allExams.find(x => x.id === r.eid);
    if (e && e.questions.length) {
      totalScore += r.score;
      maxScore += e.questions.length;
    }
  });

  if (!maxScore) return { level: "Chưa đánh giá", color: "#6b7280", pct: 0, text: "Dữ liệu kiểm tra chưa đủ." };

  const pct = Math.round((totalScore / maxScore) * 100);
  if (pct >= 90) return { level: "Xuất sắc 🌟", color: "#059669", pct, text: "Kiến thức rất vững chắc! Hãy tiếp tục duy trì phong độ đỉnh cao này." };
  if (pct >= 80) return { level: "Giỏi 🎯", color: "#0284c7", pct, text: "Kết quả rất tốt! Luyện tập thêm các câu nâng cao để đạt điểm tối đa." };
  if (pct >= 65) return { level: "Khá 👍", color: "#d97706", pct, text: "Nắm cơ bản khá tốt! Cần xem lại các bài tập làm sai để tiến bộ hơn." };
  if (pct >= 50) return { level: "Trung bình 📚", color: "#ca8a04", pct, text: "Cần tích cực ôn tập lại lý thuyết và làm thêm bài luyện tập." };
  return { level: "Cần cố gắng ⚠️", color: "#dc2626", pct, text: "Hãy dành nhiều thời gian ôn luyện hơn để củng cố lại kiến thức nền tảng." };
}

// ===== Đăng nhập =====
function viewLogin() {
  clearInterval(timerId);
  applyBgColor();
  $("#bar").hidden = true;
  app.innerHTML = `<div class="card login"><h1>ChiCute Đăng nhập</h1>
  <label>Tên đăng nhập<input id="u" autocomplete="username"></label>
  <label>Mật khẩu<input id="p" type="password" autocomplete="current-password"></label>
  <p id="err" class="bad"></p>
  <div class="row"><button id="go">Đăng nhập</button><button id="reg" class="ghost">Tạo tài khoản học sinh</button></div></div>`;
  const err = t => $("#err").textContent = t;
  $("#go").onclick = async () => {
    await sync();
    const u = $("#u").value.trim(), p = $("#p").value;
    if (u === ADMIN.user && p === ADMIN.pass) return enter({ role: "admin", name: "Admin" });
    const x = db.users.find(x => x.u === u && x.p === p);
    x ? enter({ role: "student", name: u }) : err("Sai tên đăng nhập hoặc mật khẩu.");
  };
  $("#reg").onclick = async () => {
    await sync();
    const u = $("#u").value.trim(), p = $("#p").value;
    if (!u || p.length < 4) return err("Nhập tên và mật khẩu từ 4 ký tự.");
    if (db.users.some(x => x.u === u) || u === ADMIN.user) return err("Tên này đã tồn tại.");
    await addTo("users", { u, p }); 
    enter({ role: "student", name: u });
  };
  [$("#u"), $("#p")].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") $("#go").click(); }));
}
function enter(user) { me = user; sessionStorage.setItem("me", JSON.stringify(me)); home(); }
$("#logout").onclick = () => { sessionStorage.removeItem("me"); me = null; viewLogin(); };

function shell(html) {
  clearInterval(timerId);
  applyBgColor();
  $("#bar").hidden = false; $("#who").textContent = `${me.name} (${me.role === "admin" ? "admin" : "học sinh"})`;
  app.innerHTML = html;
}
const home = async () => { await sync(); me.role === "admin" ? adminHome() : studentHome(); };

// ===== Học sinh =====
const prog = s => { const n = s.lessons.length; return n ? Math.round(100 * s.lessons.filter(l => db.progress.includes(me.name + "|" + l.id)).length / n) : 0; };
const progHtml = s => { const p = prog(s); return `<div class="prog"><span>Tiến độ ôn luyện</span><b>${p}%</b></div><div class="bar"><i style="width:${p}%"></i></div>`; };
const scheduled = () => db.subjects.filter(s => s.visible).flatMap(s => s.exams.filter(e => e.start).map(e => ({ ...e, sn: s.name, sid: s.id }))).sort((a, b) => new Date(a.start) - new Date(b.start));
const isDone = e => db.results.some(r => r.eid === e.id && r.user === me.name);

function studentHome() {
  const subs = db.subjects.filter(s => s.visible);
  const n = scheduled().filter(e => !isDone(e)).length;
  const evalData = getAcademicEval(me.name);

  shell(`
  ${db.banner ? `<div class="banner-box"><img src="${esc(db.banner)}" alt="Banner thông báo"></div>` : ""}
  <h1>Danh mục Môn học</h1>
  <div class="grid">${subs.map((s, i) => `<div class="card subj c${i % 4}" data-s="${s.id}"><div class="ico">${esc(s.icon || "📘")}</div><span class="tag">MÔN HỌC ${String(i + 1).padStart(2, "0")}</span><h3>${esc(s.name)}</h3><p class="mute">${esc(s.desc || `${s.lessons.length} bài ôn luyện · ${s.exams.length} bài kiểm tra`)}</p>${progHtml(s)}<button>Vào ôn luyện ▶</button></div>`).join("") || '<p class="mute">Chưa có môn học nào được mở. Hãy quay lại sau.</p>'}</div>
  
  <div class="menus">
    <div class="card menu eval-card" data-go="eval">
      <div class="ico">📊</div>
      <div>
        <h3>Đánh giá Học lực: <span class="eval-badge" style="background:${evalData.color}">${evalData.level}</span></h3>
        <p class="mute">${evalData.pct}% tỉ lệ chính xác. ${evalData.text}</p>
      </div>
      <button aria-label="Xem chi tiết">›</button>
    </div>
    <div class="card menu" data-go="history"><div class="ico">📜</div><div><h3>Lịch sử Kiểm tra</h3><p class="mute">Xem lại điểm số và kết quả các bài kiểm tra đã làm.</p></div><button aria-label="Mở lịch sử">›</button></div>
    <div class="card menu m2" data-go="schedule"><div class="ico">📅</div><div><h3>Lịch kiểm tra sắp tới${n ? ' <span class="new">Mới</span>' : ""}</h3><p class="mute">${n ? `${n} bài kiểm tra cần lưu ý.` : "Chưa có lịch kiểm tra."}</p></div><button aria-label="Mở lịch kiểm tra">›</button></div>
  </div>`);

  app.querySelectorAll(".subj").forEach(c => c.onclick = () => subjectView(c.dataset.s));
  app.querySelectorAll("[data-go]").forEach(c => c.onclick = () => {
    if (c.dataset.go === "eval") evalView();
    else if (c.dataset.go === "history") historyView();
    else scheduleView();
  });
}

function evalView() {
  const evalData = getAcademicEval(me.name);
  const myResults = db.results.filter(r => r.user === me.name);

  shell(`
  <button class="ghost" id="back">← Về trang chủ</button>
  <h1 style="margin-top:12px">Đánh giá Học lực & Tiến bộ</h1>
  <div class="card eval-card">
    <h2>Học lực hiện tại: <span class="eval-badge" style="background:${evalData.color}">${evalData.level}</span></h2>
    <p style="font-size:1.1rem;margin:10px 0"><strong>Tỉ lệ làm bài chính xác:</strong> ${evalData.pct}%</p>
    <p style="margin:0">${evalData.text}</p>
  </div>
  <h2>Thống kê chi tiết</h2>
  <div class="card">
    <p>Tổng số bài kiểm tra đã hoàn thành: <strong>${myResults.length}</strong> bài</p>
  </div>`);
  $("#back").onclick = home;
}

function historyView() {
  const all = db.subjects.flatMap(s => s.exams.map(x => ({ ...x, sn: s.name })));
  const rows = db.results.filter(r => r.user === me.name).sort((a, b) => b.at - a.at).map(r => {
    const e = all.find(x => x.id === r.eid);
    return `<div class="card"><h3>${e ? esc(e.title) : "(bài kiểm tra đã xóa)"}</h3><p class="mute" style="margin:0">${e ? esc(e.sn) + " · " : ""}${fmt(r.at)}</p><p style="margin:6px 0 0"><strong class="ok">${r.score}/${e ? e.questions.length : "?"}</strong> câu đúng</p></div>`;
  });
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">Lịch sử Kiểm tra</h1>${rows.join("") || '<p class="mute">Bạn chưa làm bài kiểm tra nào. Vào một môn học, chọn tab Kiểm tra để bắt đầu.</p>'}`);
  $("#back").onclick = home;
}

function scheduleView() {
  const rows = scheduled().map(e => {
    const st = isDone(e) ? "Đã làm" : new Date(e.start) > Date.now() ? "Sắp diễn ra" : "Đang mở";
    return `<div class="card row"><div style="flex:1"><h3>${esc(e.title)} <span class="tag">${st}</span></h3><p class="mute" style="margin:0">${esc(e.sn)} · ${fmt(e.start)} · ${e.duration} phút</p></div>${st === "Đã làm" ? "" : `<button data-sid="${e.sid}">Đến môn học</button>`}</div>`;
  });
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">Lịch kiểm tra sắp tới</h1>${rows.join("") || '<p class="mute">Chưa có lịch kiểm tra nào.</p>'}`);
  $("#back").onclick = home;
  app.querySelectorAll("[data-sid]").forEach(b => b.onclick = () => subjectView(b.dataset.sid, "exam"));
}

function subjectView(id, tab = "learn") {
  const s = subj(id);
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">${esc(s.name)}</h1>${progHtml(s)}
  <div class="tabs"><button class="${tab === "learn" ? "on" : ""}" data-t="learn">Ôn luyện</button><button class="${tab === "exam" ? "on" : ""}" data-t="exam">Kiểm tra</button></div><div id="tab"></div>`);
  $("#back").onclick = home;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => subjectView(id, b.dataset.t));
  if (tab === "learn") {
    $("#tab").innerHTML = s.lessons.map(l => `<div class="card"><h3>${esc(l.title)}</h3><div class="video"><iframe src="https://www.youtube.com/embed/${ytId(l.url)}" allowfullscreen loading="lazy" title="${esc(l.title)}"></iframe></div>${db.progress.includes(me.name + "|" + l.id) ? `<button class="ghost" data-lp="${l.id}">✓ Đã ôn xong</button>` : `<button data-lp="${l.id}">Đánh dấu đã ôn</button>`}</div>`).join("") || '<p class="mute">Chưa có bài ôn luyện.</p>';
    app.querySelectorAll("[data-lp]").forEach(b => b.onclick = async () => {
      const k = me.name + "|" + b.dataset.lp;
      if (db.progress.includes(k)) await removeFrom("progress", k); else await addTo("progress", k);
      subjectView(id, "learn");
    });
  } else {
    $("#tab").innerHTML = s.exams.map(e => {
      const st = e.start ? new Date(e.start).getTime() : 0, done = db.results.find(r => r.eid === e.id && r.user === me.name);
      return `<div class="card"><h3>${esc(e.title)}</h3><p class="mute">${e.duration} phút · ${e.questions.length} câu${e.start ? " · Mở lúc " + fmt(e.start) : ""}</p>
      ${done ? `<p class="ok">Đã làm: ${done.score}/${e.questions.length} điểm</p>` : st > Date.now() ? '<p class="mute">Chưa đến giờ kiểm tra.</p>' : `<button data-e="${e.id}">Bắt đầu làm bài</button>`}</div>`;
    }).join("") || '<p class="mute">Chưa có bài kiểm tra.</p>';
    app.querySelectorAll("[data-e]").forEach(b => b.onclick = () => confirm("Đồng hồ sẽ chạy ngay khi bắt đầu. Tiếp tục?") && takeExam(id, b.dataset.e));
  }
}

function takeExam(sid, eid) {
  const s = subj(sid), e = s.exams.find(x => x.id === eid);
  const endKey = `end-${me.name}-${eid}`;
  let end = +sessionStorage.getItem(endKey);
  if (!end) { end = Date.now() + e.duration * 60000; sessionStorage.setItem(endKey, end); }
  shell(`<h1>${esc(e.title)}</h1><div class="timer" id="t"></div>
  ${e.questions.map((q, i) => `<div class="card"><strong>Câu ${i + 1}. ${esc(q.q)}</strong>${q.opts.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}">${esc(o)}</label>`).join("")}</div>`).join("")}
  <button id="submit">Nộp bài</button>`);
  let finished = false;
  const finish = async auto => {
    if (finished) return; finished = true; clearInterval(timerId);
    let score = 0;
    e.questions.forEach((q, i) => { const c = document.querySelector(`input[name=q${i}]:checked`); if (c && +c.value === q.ans) score++; });
    sessionStorage.removeItem(endKey);
    await addTo("results", { eid, user: me.name, score, at: Date.now() });
    shell(`<div class="card"><h1>${auto ? "Hết giờ!" : "Đã nộp bài"}</h1><p>Điểm của bạn: <strong>${score}/${e.questions.length}</strong></p><button id="b">Về trang chủ</button></div>`);
    $("#b").onclick = home;
  };
  const tick = () => {
    const left = Math.max(0, end - Date.now()), m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60;
    $("#t").textContent = `Còn lại ${m}:${String(sec).padStart(2, "0")}`; $("#t").classList.toggle("low", left < 60000);
    if (left <= 0) finish(true);
  };
  tick(); timerId = setInterval(tick, 500);
  $("#submit").onclick = () => confirm("Nộp bài ngay?") && finish(false);
}

// ===== Admin =====
function adminHome() {
  const exams = db.subjects.flatMap(s => s.exams);
  shell(`<h1>Quản lý hệ thống</h1>
  <div class="card"><h3>Giao diện trang học sinh</h3>
    <label>Link ảnh banner (để trống nếu không dùng)<input id="bn" value="${esc(db.banner)}" placeholder="https://..."></label>
    <label>Màu nền<input id="bg" type="color" value="${esc(db.bgColor || "#fff7dc")}" style="width:90px;height:44px;padding:2px"></label>
    <button id="sv">Lưu giao diện</button></div>
  <h2>Môn học</h2>
  <div class="card"><div class="row"><input id="ni" placeholder="📘" maxlength="4" aria-label="Biểu tượng" style="width:70px;margin:0;text-align:center"><input id="ns" placeholder="Tên môn học mới" style="flex:1;margin:0"></div><input id="nd" placeholder="Mô tả ngắn (hiện trên thẻ môn học)" style="margin:10px 0"><button id="add">Thêm môn</button></div>
  ${db.subjects.map(s => `<div class="card row"><label style="flex:1"><input type="checkbox" data-v="${s.id}" ${s.visible ? "checked" : ""} style="margin-right:8px">Hiện cho học sinh: <strong>${esc(s.name)}</strong></label>
  <button data-m="${s.id}">Quản lý</button><button class="del" data-d="${s.id}">Xóa</button></div>`).join("") || '<p class="mute">Chưa có môn nào. Hãy thêm môn đầu tiên.</p>'}
  <h2 style="margin-top:24px">Kết quả kiểm tra</h2>${db.results.map(r => { const e = exams.find(x => x.id === r.eid); return `<div class="card">${esc(r.user)} · ${esc(e ? e.title : "(đã xóa)")}: <strong>${r.score}</strong> điểm <span class="mute">${fmt(r.at)}</span></div>`; }).join("") || '<p class="mute">Chưa có bài nộp.</p>'}`);
  $("#sv").onclick = async () => { db.banner = $("#bn").value.trim(); db.bgColor = $("#bg").value; applyBgColor(); await save("banner", "bgColor"); alert("Đã lưu giao diện."); };
  $("#add").onclick = async () => {
    const n = $("#ns").value.trim(); if (!n) return;
    db.subjects.push({ id: uid(), name: n, icon: $("#ni").value.trim() || "📘", desc: $("#nd").value.trim(), visible: false, lessons: [], exams: [] });
    await save("subjects"); adminHome();
  };
  app.querySelectorAll("[data-v]").forEach(c => c.onchange = async () => { subj(c.dataset.v).visible = c.checked; await save("subjects"); });
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => adminSubject(b.dataset.m));
  app.querySelectorAll("[data-d]").forEach(b => b.onclick = async () => { if (confirm("Xóa môn này cùng bài giảng và bài kiểm tra?")) { db.subjects = db.subjects.filter(s => s.id !== b.dataset.d); await save("subjects"); adminHome(); } });
}

function adminSubject(id) {
  const s = subj(id);
  shell(`<button class="ghost" id="back">← Quay lại</button><h1 style="margin-top:12px">${esc(s.name)}</h1>
  <h2>Bài ôn luyện (video)</h2>${s.lessons.map(l => `<div class="card row"><span style="flex:1">${esc(l.title)} <span class="mute">${esc(l.url)}</span></span><button class="del" data-dl="${l.id}">Xóa</button></div>`).join("")}
  <div class="card"><input id="lt" placeholder="Tên bài giảng"><input id="lu" placeholder="Link YouTube"><p id="le" class="bad"></p><button id="al">Thêm bài giảng</button></div>
  <h2>Bài kiểm tra</h2>${s.exams.map(e => `<div class="card row"><span style="flex:1">${esc(e.title)} · ${e.duration} phút · ${e.questions.length} câu${e.start ? " · " + fmt(e.start) : ""}</span><button class="del" data-de="${e.id}">Xóa</button></div>`).join("")}
  <div class="card"><input id="et" placeholder="Tên bài kiểm tra">
  <div class="row"><label>Thời gian làm bài (phút)<input id="ed" type="number" min="1" value="15"></label><label>Lịch kiểm tra (không bắt buộc)<input id="es" type="datetime-local"></label></div>
  <label>Câu hỏi: mỗi câu 6 dòng — câu hỏi, 4 đáp án, rồi số đáp án đúng (1-4). Cách nhau bằng một dòng trống.
  <textarea id="eq" rows="9" placeholder="2 + 2 bằng mấy?&#10;3&#10;4&#10;5&#10;6&#10;2"></textarea></label><p id="ee" class="bad"></p><button id="ae">Thêm bài kiểm tra</button></div>`);
  $("#back").onclick = adminHome;
  $("#al").onclick = async () => {
    const t = $("#lt").value.trim(), u = $("#lu").value.trim();
    if (!t || !ytId(u)) return $("#le").textContent = "Cần tên bài và link YouTube hợp lệ.";
    s.lessons.push({ id: uid(), title: t, url: u }); await save("subjects"); adminSubject(id);
  };
  $("#ae").onclick = async () => {
    const t = $("#et").value.trim(), d = +$("#ed").value, bad = m => $("#ee").textContent = m;
    const qs = $("#eq").value.trim().split(/\n\s*\n/).filter(Boolean).map(b => { const l = b.split("\n").map(x => x.trim()); return { q: l[0], opts: l.slice(1, 5), ans: (+l[5]) - 1 }; });
    if (!t || d < 1) return bad("Cần tên bài kiểm tra và thời gian hợp lệ.");
    if (!qs.length || qs.some(q => q.opts.length < 4 || !(q.ans >= 0 && q.ans < 4))) return bad("Câu hỏi sai định dạng: mỗi câu cần 1 câu hỏi, 4 đáp án và số đáp án đúng.");
    s.exams.push({ id: uid(), title: t, duration: d, start: $("#es").value || "", questions: qs }); await save("subjects"); adminSubject(id);
  };
  app.querySelectorAll("[data-dl]").forEach(b => b.onclick = async () => { s.lessons = s.lessons.filter(l => l.id !== b.dataset.dl); await save("subjects"); adminSubject(id); });
  app.querySelectorAll("[data-de]").forEach(b => b.onclick = async () => { s.exams = s.exams.filter(e => e.id !== b.dataset.de); await save("subjects"); adminSubject(id); });
}

// ===== Khởi chạy =====
loadDataFromCloud();
