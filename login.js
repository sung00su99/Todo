const SUPABASE_URL = 'https://ftmrlvcrikvrywfuygre.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bXJsdmNyaWt2cnl3ZnV5Z3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDQ4MTAsImV4cCI6MjA5NDc4MDgxMH0.x6GQu0v1EDK66HXL_Lz5Ml8ZK4ucld5aZV5EqtxomSA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// 이미 로그인된 경우 바로 이동
db.auth.getSession().then(({ data: { session } }) => {
  if (session) location.href = 'index.html';
});

// ── 탭 전환 ──
const loginForm  = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const tabLogin   = document.getElementById('tab-login');
const tabSignup  = document.getElementById('tab-signup');

tabLogin.addEventListener('click', () => {
  loginForm.style.display  = '';
  signupForm.style.display = 'none';
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
});

tabSignup.addEventListener('click', () => {
  loginForm.style.display  = 'none';
  signupForm.style.display = '';
  tabLogin.classList.remove('active');
  tabSignup.classList.add('active');
});

// ── 로그인 ──
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.textContent = '';

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    return;
  }
  location.href = 'index.html';
});

// ── 회원가입 ──
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('signup-email').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  const errorEl  = document.getElementById('signup-error');
  const successEl = document.getElementById('signup-success');
  errorEl.textContent = '';
  successEl.textContent = '';

  if (password !== confirm) {
    errorEl.textContent = '비밀번호가 일치하지 않습니다.';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = '비밀번호는 6자 이상이어야 합니다.';
    return;
  }

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  // 닉네임 저장 (트리거가 이메일 앞부분으로 기본 생성한 것을 실제 닉네임으로 덮어씀)
  if (data.user) {
    await db.from('profiles').upsert({ id: data.user.id, nickname });
  }

  if (data.session) {
    // 이메일 인증 미사용 설정 → 즉시 로그인
    location.href = 'index.html';
  } else {
    successEl.textContent = '가입 완료! 이메일 인증 후 로그인해주세요.';
  }
});
