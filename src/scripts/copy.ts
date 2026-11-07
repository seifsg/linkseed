/** Reveals copy buttons and copies their snippet text to the clipboard. */
for (const btn of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  const code = document.getElementById(btn.dataset['copy'] ?? '');
  if (!code || !navigator.clipboard) continue;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Press Ctrl+C';
      getSelection()?.selectAllChildren(code);
    }
    setTimeout(() => (btn.textContent = 'Copy'), 1800);
  });
}
