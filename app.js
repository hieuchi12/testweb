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

// Tải dữ liệu từ Firestore lên ứng dụng
async function loadDataFromCloud() {
  try {
    const docRef = dbFirestore.collection("system").doc("config");
    const doc = await docRef.get();
    if (doc.exists) {
      db = { ...db, ...doc.data() };
    } else {
      await docRef.set(db);
    }
  } catch (e) {
    console.error("Lỗi tải dữ liệu từ Firebase:", e);
  }
  applyBgColor();
  if (me) home(); else viewLogin();
}

// Lưu dữ liệu lên Firestore
async function save() {
  try {
    await dbFirestore.collection("system").doc("config").set(db);
  } catch (e) {
    console.error("Lỗi lưu dữ liệu lên Firebase:", e);
  }
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
  $("#go").onclick = () => {
    const u = $("#u").value.trim(), p = $("#p").value;
    if (u === ADMIN.user && p === ADMIN.pass) return enter({ role: "admin", name: "Admin" });
    const x = db.users.find(x => x.u === u && x.p === p);
    x ? enter({ role: "student", name: u }) : err("Sai tên đăng nhập hoặc mật khẩu.");
  };
  $("#reg").onclick = async () => {
    const u = $("#u").value.trim(), p = $("#p").value;
    if (!u || p.length < 4) return err("Nhập tên và mật khẩu từ 4 ký tự.");
    if (db.users.some(x => x.u === u) || u === ADMIN.user) return err("Tên này đã tồn tại.");
    db.users.push({ u, p }); 
    await save(); 
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
const home = () => me.role === "admin" ? adminHome() : studentHome();

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
  <div class="grid">${subs.map((s, i) => `<div class="card subj c${i \% 4}" data-s="${s.id}"><div class="ico">${esc(s.icon || "📘")}</div><span class="tag">MÔN HỌC ${String(i + 1).padStart(2, "0")}</span><h3>${esc(s.name)}</h3><p class="mute">${esc(s.desc \vert{}\vert{} `${s.lessons.length} bài ôn luyện · ${s.exams.length} bài kiểm tra`)}</p>${progHtml(s)}<button>Vào ôn luyện ▶</button></div>`).join("") || '<p class="mute">Chưa có môn học nào được mở. Hãy quay lại sau.</p>'}</div>
  
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
    $("#tab").innerHTML = s.lessons.map(l => `<div class="card"><h3>${esc(l.title)}</h3><div class="video"><iframe src="https://www.youtube.com/embed/${ytId(l.url)}" allowfullscreen loading="lazy" title="${esc(l.title)}"></iframe></div>${db.progress.includes(me.name + "|" + l.id) ? `<button class="ghost