const API = '/api';
const errorEl = document.getElementById('errorMsg');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const switchBtn = document.getElementById('switchBtn');

let isLogin = true;

switchBtn.addEventListener('click', () => {
  isLogin = !isLogin;
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);
  switchBtn.textContent = isLogin ? '还没有账号？去注册' : '已有账号？去登录';
  errorEl.textContent = '';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  if (!username || !password) {
    errorEl.textContent = '请填写完整信息';
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      window.location.href = '/';
    } else {
      errorEl.textContent = data.error;
    }
  } catch {
    errorEl.textContent = '网络错误，请重试';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  const password2 = document.getElementById('regPass2').value;

  if (!username || !password) {
    errorEl.textContent = '请填写完整信息';
    return;
  }
  if (password !== password2) {
    errorEl.textContent = '两次密码不一致';
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      window.location.href = '/';
    } else {
      errorEl.textContent = data.error;
    }
  } catch {
    errorEl.textContent = '网络错误，请重试';
  }
});
