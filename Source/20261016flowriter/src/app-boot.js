// =====================================================================
// Boot: form submits, then start (with Supabase when config.js is present)
// =====================================================================
document.addEventListener('submit', async e => {
  const f = e.target, name = f.dataset.form; if (!name) return; e.preventDefault();
  if (FORMS[name]) { const err = f.querySelector('.form-error'); if (err) err.textContent = ''; try { await FORMS[name](f); } catch (x) { if (err) err.textContent = x.message; else toast(esc(x.message)); } return; }
  submitForm(name, f);
});
if (typeof Backend !== 'undefined' && Backend.enabled) {
  $('#app').innerHTML = '<div class="auth"><p class="muted" style="font-weight:800">Loading FloWriter…</p></div>';
  Backend.boot().catch(e => { console.error('[flowriter] boot', e); setTimeout(() => toast('Couldn’t reach the FloWriter server. Check config.js and your connection.', 8000), 300); }).then(() => { if (state.recovery) { history.replaceState(null, '', location.href.split('#')[0] + '#/reset'); } render(); });
} else { restoreSession(); render(); }
