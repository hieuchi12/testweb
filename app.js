// ===== Cấu hình =====
const ADMIN = { user: "admin", pass: "admin123" };
const KEY = "lms-data-v1";

// ===== Lưu trữ dữ liệu =====
const load = () => {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { d = null; }
  return { subjects: [], users: [], results: [], progress: [], banner: "", ...(d || {}) };
};
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
let db = load();
let me = JSON.parse(sessionStorage.getItem("me") || "null");
let timerId = null;

const $ = s => document.querySelector(s);
const app = $("#app");
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = t => new Date(t).toLocaleString("vi-VN");
const subj = id => db.subjects.find(s => s.id === id);
function ytId(u) { const m = String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m && m[1]; }

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
  $("#bar").hidden = true;
  app.innerHTML = `<div class="card login"><h1>Đăng nhập</h1>
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
  $("#reg").onclick = () => {
    const u = $("#u").value.trim(), p = $("#p").value;
    if (!u || p.length < 4) return err("Nhập tên và mật khẩu từ 4 ký tự.");
    if (db.users.some(x => x.u === u) || u === ADMIN.user) return err("Tên này đã tồn tại.");
    db.users.push({ u, p }); save(); enter({ role: "student", name: u });
  };
  [$("#u"), $("#p")].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") $("#go").click(); }));
}
function enter(user) { me = user; sessionStorage.setItem("me", JSON.stringify(me)); home(); }
$("#logout").onclick = () => { sessionStorage.removeItem("me"); me = null; viewLogin(); };

function shell(html) {
  clearInterval(timerId);
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
  db = load();
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
  db = load();
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
  db = load();
  const all = db.subjects.flatMap(s => s.exams.map(x => ({ ...x, sn: s.name })));
  const rows = db.results.filter(r => r.user === me.name).sort((a, b) => b.at - a.at).map(r => {
    const e = all.find(x => x.id === r.eid);
    return `<div class="card"><h3>${e ? esc(e.title) : "(bài kiểm tra đã xóa)"}</h3><p class="mute" style="margin:0">${e ? esc(e.sn) + " · " : ""}${fmt(r.at)}</p><p style="margin:6px 0 0"><strong class="ok">${r.score}/${e ? e.questions.length : "?"}</strong> câu đúng</p></div>`;
  });
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">Lịch sử Kiểm tra</h1>${rows.join("") || '<p class="mute">Bạn chưa làm bài kiểm tra nào. Vào một môn học, chọn tab Kiểm tra để bắt đầu.</p>'}`);
  $("#back").onclick = home;
}

function scheduleView() {
  db = load();
  const rows = scheduled().map(e => {
    const st = isDone(e) ? "Đã làm" : new Date(e.start) > Date.now() ? "Sắp diễn ra" : "Đang mở";
    return `<div class="card row"><div style="flex:1"><h3>${esc(e.title)} <span class="tag">${st}</span></h3><p class="mute" style="margin:0">${esc(e.sn)} · ${fmt(e.start)} · ${e.duration} phút</p></div>${st === "Đã làm" ? "" : `<button data-sid="${e.sid}">Đến môn học</button>`}</div>`;
  });
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">Lịch kiểm tra sắp tới</h1>${rows.join("") || '<p class="mute">Chưa có lịch kiểm tra nào.</p>'}`);
  $("#back").onclick = home;
  app.querySelectorAll("[data-sid]").forEach(b => b.onclick = () => subjectView(b.dataset.sid, "exam"));
}

function subjectView(id, tab = "learn") {
  db = load();
  const s = subj(id);
  shell(`<button class="ghost" id="back">← Về trang chủ</button><h1 style="margin-top:12px">${esc(s.name)}</h1>${progHtml(s)}
  <div class="tabs"><button class="${tab === "learn" ? "on" : ""}" data-t="learn">Ôn luyện</button><button class="${tab === "exam" ? "on" : ""}" data-t="exam">Kiểm tra</button></div><div id="tab"></div>`);
  $("#back").onclick = home;
  app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => subjectView(id, b.dataset.t));
  if (tab === "learn") {
    $("#tab").innerHTML = s.lessons.map(l => `<div class="card"><h3>${esc(l.title)}</h3><div class="video"><iframe src="https://www.youtube.com/embed/${ytId(l.url)}" allowfullscreen loading="lazy" title="${esc(l.title)}"></iframe></div>${db.progress.includes(me.name + "|" + l.id) ? `<button class="ghost" data-lp="${l.id}">✓ Đã ôn luyện xong</button>` : `<button data-lp="${l.id}">Đánh dấu đã ôn luyện</button>`}</div>`).join("") || '<p class="mute">Chưa có nội dung ôn luyện.</p>';
    app.querySelectorAll("[data-lp]").forEach(b => b.onclick = () => { const k = me.name + "|" + b.dataset.lp, i = db.progress.indexOf(k); if (i < 0) db.progress.push(k); else db.progress.splice(i, 1); save(); subjectView(id, "learn"); });
  } else {
    $("#tab").innerHTML = s.exams.map(e => {
      const now = Date.now(), st = e.start ? new Date(e.start).getTime() : 0, done = db.results.find(r => r.eid === e.id && r.user === me.name);
      const wait = st > now;
      return `<div class="card"><h3>${esc(e.title)}</h3><p class="mute">${e.duration} phút · ${e.questions.length} câu${e.start ? " · Mở lúc " + fmt(e.start) : ""}</p>
      ${done ? `<p class="ok">Đã làm: ${done.score}/${e.questions.length} điểm</p>` : wait ? '<p class="mute">Chưa đến giờ kiểm tra.</p>' : `<button data-e="${e.id}">Bắt đầu kiểm tra</button>`}</div>`;
    }).join("") || '<p class="mute">Chưa có bài kiểm tra.</p>';
    app.querySelectorAll("[data-e]").forEach(b => b.onclick = () => confirm("Đồng hồ sẽ chạy ngay khi bắt đầu. Tiếp tục?") && takeExam(id, b.dataset.e));
  }
}

function takeExam(sid, eid) {
  db = load();
  const s = subj(sid), e = s.exams.find(x => x.id === eid);
  const endKey = `end-${me.name}-${eid}`;
  let end = +sessionStorage.getItem(endKey);
  if (!end) { end = Date.now() + e.duration * 60000; sessionStorage.setItem(endKey, end); }
  shell(`<h1>${esc(e.title)}</h1><div class="timer" id="t"></div>
  ${e.questions.map((q, i) => `<div class="card"><strong>Câu ${i + 1}. ${esc(q.q)}</strong>${q.opts.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}">${esc(o)}</label>`).join("")}</div>`).join("")}
  <button id="submit">Nộp bài</button>`);
  let finished = false;
  const finish = auto => {
    if (finished) return; finished = true; clearInterval(timerId);
    let score = 0; e.questions.forEach((q, i) => { const c = document.querySelector(`input[name=q${i}]:checked`); if (c && +c.value === q.ans) score++; });
    db = load(); db.results.push({ eid, user: me.name, score, at: Date.now() }); save(); sessionStorage.removeItem(endKey);
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
  db = load();
  shell(`
  <h1>Quản trị Hệ thống</h1>
  
  <!-- Cấu hình Banner Menu Học Sinh -->
  <div class="card">
    <h2>🖼️ Quản lý Banner Học Sinh</h2>
    <p class="mute">Tải ảnh lên từ máy hoặc dán đường link hình ảnh banner:</p>
    <div class="row">
      <input id="banner-url" placeholder="https://danh-sach-anh.com/banner.jpg" value="${esc(db.banner || "")}" style="flex:1;margin:0">
      <button id="save-banner">Lưu URL Banner</button>
    </div>
    <div style="margin-top:10px">
      <label class="ghost button" style="cursor:pointer;display:inline-block;padding:8px 18px;border-radius:16px;border:2px solid var(--line);font-weight:700">
        📁 Chọn file ảnh từ máy
        <input type="file" id="banner-file" accept="image/*" style="display:none">
      </label>
      ${db.banner ? `<button class="del" id="del-banner">Xóa Banner hiện tại</button>` : ""}
    </div>
    ${db.banner ? `<div style="margin-top:12px"><strong>Xem trước:</strong><br><img src="${esc(db.banner)}" style="max-height:120px;border-radius:12px;margin-top:6px;border:2px solid var(--line)"></div>` : ""}
  </div>

  <!-- Quản lý môn học -->
  <div class="card">
    <h2>📘 Quản lý Môn học</h2>
    <div class="row">
      <input id="ni" placeholder="📘" maxlength="4" aria-label="Biểu tượng" style="width:70px;margin:0;text-align:center">
      <input id="ns" placeholder="Tên môn học mới" style="flex:1;margin:0">
    </div>
    <input id="nd" placeholder="Mô tả ngắn (hiện trên thẻ môn học)" style="margin:10px 0">
    <button id="add">Thêm môn</button>
  </div>

  ${db.subjects.map(s => `<div class="card row"><label style="flex:1"><input type="checkbox" data-v="${s.id}" ${s.visible ? "checked" : ""} style="width:auto;margin-right:8px">Hiện cho học sinh: <strong>${esc(s.name)}</strong></label>
  <button data-m="${s.id}">Quản lý</button><button class="del" data-d="${s.id}">Xóa</button></div>`).join("") || '<p class="mute">Chưa có môn nào.</p>'}

  <!-- Quản lý học sinh -->
  <h2 style="margin-top:28px">👥 Quản lý Học sinh</h2>
  <div class="card">
    ${db.users.length ? db.users.map(u => {
      const doneCount = db.results.filter(r => r.user === u.u).length;
      return `<div class="row" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line);justify-content:space-between">
        <div><strong>${esc(u.u)}</strong> <span class="mute">(${doneCount} bài đã kiểm tra)</span></div>
        <button class="del" data-deluser="${esc(u.u)}" style="padding:4px 12px;font-size:0.9rem">Xóa tài khoản</button>
      </div>`;
    }).join("") : '<p class="mute">Chưa có tài khoản học sinh nào đăng ký.</p>'}
  </div>

  <!-- Quản lý Lịch sử kiểm tra -->
  <div class="row" style="justify-content:space-between;align-items:center;margin-top:28px">
    <h2 style="margin:0">📜 Lịch sử Kiểm tra Toàn hệ thống</h2>
    ${db.results.length ? `<button class="del" id="clear-all-results">Xóa TOÀN BỘ lịch sử</button>` : ""}
  </div>
  <div style="margin-top:12px">
  ${db.results.map((r, idx) => { 
    const e = db.subjects.flatMap(s => s.exams).find(x => x.id === r.eid); 
    return `<div class="card row" style="justify-content:space-between">
      <div><strong>${esc(r.user)}</strong> · ${esc(e ? e.title : "(đã xóa)")}: <strong class="ok">${r.score}</strong> điểm <span class="mute">(${fmt(r.at)})</span></div>
      <button class="del" data-delres="${idx}" style="padding:4px 10px;font-size:0.85rem">Xóa</button>
    </div>`; 
  }).join("") || '<p class="mute">Chưa có bài nộp nào.</p>'}
  </div>
  `);

  // Xử lý Sự kiện Admin Banner
  $("#save-banner").onclick = () => {
    db.banner = $("#banner-url").value.trim();
    save();
    adminHome();
  };
  $("#banner-file").onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        db.banner = evt.target.result;
        save();
        adminHome();
      };
      reader.readAsDataURL(file);
    }
  };
  if ($("#del-banner")) {
    $("#del-banner").onclick = () => {
      db.banner = "";
      save();
      adminHome();
    };
  }

  // Thêm môn học
  $("#add").onclick = () => { 
    const n = $("#ns").value.trim(); 
    if (!n) return; 
    db.subjects.push({ id: uid(), name: n, icon: $("#ni").value.trim() || "📘", desc: $("#nd").value.trim(), visible: false, lessons: [], exams: [] }); 
    save(); 
    adminHome(); 
  };
  
  app.querySelectorAll("[data-v]").forEach(c => c.onchange = () => { subj(c.dataset.v).visible = c.checked; save(); });
  app.querySelectorAll("[data-m]").forEach(b => b.onclick = () => adminSubject(b.dataset.m));
  app.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { if (confirm("Xóa môn này cùng bài giảng và bài thi?")) { db.subjects = db.subjects.filter(s => s.id !== b.dataset.d); save(); adminHome(); } });

  // Xóa tài khoản học sinh
  app.querySelectorAll("[data-deluser]").forEach(b => b.onclick = () => {
    const uname = b.dataset.deluser;
    if (confirm(`Bạn có chắc muốn xóa tài khoản học sinh "${uname}"?`)) {
      db.users = db.users.filter(u => u.u !== uname);
      db.results = db.results.filter(r => r.user !== uname);
      save();
      adminHome();
    }
  });

  // Xóa lịch sử kiểm tra
  app.querySelectorAll("[data-delres]").forEach(b => b.onclick = () => {
    const idx = +b.dataset.delres;
    db.results.splice(idx, 1);
    save();
    adminHome();
  });

  if ($("#clear-all-results")) {
    $("#clear-all-results").onclick = () => {
      if (confirm("Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử kiểm tra của tất cả học sinh?")) {
        db.results = [];
        save();
        adminHome();
      }
    };
  }
}

function adminSubject(id) {
  db = load();
  const s = subj(id);
  shell(`<button class="ghost" id="back">← Quay lại</button><h1 style="margin-top:12px">${esc(s.name)}</h1>
  <h2>Nội dung Ôn luyện (Bài giảng)</h2>${s.lessons.map(l => `<div class="card row"><span style="flex:1">${esc(l.title)} <span class="mute">${esc(l.url)}</span></span><button class="del" data-dl="${l.id}">Xóa</button></div>`).join("")}
  <div class="card"><input id="lt" placeholder="Tên bài ôn luyện"><input id="lu" placeholder="Link YouTube"><p id="le" class="bad"></p><button id="al">Thêm bài ôn luyện</button></div>
  <h2>Bài Kiểm tra</h2>${s.exams.map(e => `<div class="card row"><span style="flex:1">${esc(e.title)} · ${e.duration} phút · ${e.questions.length} câu${e.start ? " · " + fmt(e.start) : ""}</span><button class="del" data-de="${e.id}">Xóa</button></div>`).join("")}
  <div class="card"><input id="et" placeholder="Tên bài kiểm tra">
  <div class="row"><label>Thời gian làm bài (phút)<input id="ed" type="number" min="1" value="15"></label><label>Lịch kiểm tra (không bắt buộc)<input id="es" type="datetime-local"></label></div>
  <label>Câu hỏi: mỗi câu 6 dòng — câu hỏi, 4 đáp án, rồi số đáp án đúng (1-4). Cách nhau bằng một dòng trống.
  <textarea id="eq" rows="9" placeholder="2 + 2 bằng mấy?&#10;3&#10;4&#10;5&#10;6&#10;2"></textarea></label><p id="ee" class="bad"></p><button id="ae">Thêm bài kiểm tra</button></div>`);
  $("#back").onclick = adminHome;
  $("#al").onclick = () => { const t = $("#lt").value.trim(), u = $("#lu").value.trim(); if (!t || !ytId(u)) return $("#le").textContent = "Cần tên bài và link YouTube hợp lệ."; s.lessons.push({ id: uid(), title: t, url: u }); save(); adminSubject(id); };
  $("#ae").onclick = () => {
    const t = $("#et").value.trim(), d = +$("#ed").value, bad = m => $("#ee").textContent = m;
    const qs = $("#eq").value.trim().split(/\n\s*\n/).filter(Boolean).map(b => { const l = b.split("\n").map(x => x.trim()); return { q: l[0], opts: l.slice(1, 5), ans: (+l[5]) - 1 }; });
    if (!t || d < 1) return bad("Cần tên bài kiểm tra và thời gian hợp lệ.");
    if (!qs.length || qs.some(q => q.opts.length < 4 || !(q.ans >= 0 && q.ans < 4))) return bad("Câu hỏi sai định dạng: mỗi câu cần 1 câu hỏi, 4 đáp án và số đáp án đúng.");
    s.exams.push({ id: uid(), title: t, duration: d, start: $("#es").value || "", questions: qs }); save(); adminSubject(id);
  };
  app.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => { s.lessons = s.lessons.filter(l => l.id !== b.dataset.dl); save(); adminSubject(id); });
  app.querySelectorAll("[data-de]").forEach(b => b.onclick = () => { s.exams = s.exams.filter(e => e.id !== b.dataset.de); save(); adminSubject(id); });
}

me ? home() : viewLogin();