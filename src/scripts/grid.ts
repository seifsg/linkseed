/** Client-side search and category filter over the rendered cards; the page works without it. */
const root = document.querySelector<HTMLElement>('[data-grid]');
const form = root?.querySelector<HTMLFormElement>('.filters');
const q = root?.querySelector<HTMLInputElement>('#q');
const cat = root?.querySelector<HTMLSelectElement>('#cat');
const count = root?.querySelector<HTMLElement>('.count');
const items = [...(root?.querySelectorAll<HTMLLIElement>('.grid > li') ?? [])];

/** Shows the cards matching every search word and the chosen category, then announces the count. */
function apply(): void {
  const terms = (q?.value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const c = cat?.value ?? '';
  let shown = 0;
  for (const li of items) {
    const text = li.dataset['text'] ?? '';
    const hit = (!c || li.dataset['cat'] === c) && terms.every((t) => text.includes(t));
    li.hidden = !hit;
    if (hit) shown++;
  }
  if (count) count.textContent = shown === items.length ? '' : shown ? `Showing ${shown} of ${items.length}` : 'No apps match. Try another word or category.';
}

if (form && q && cat) {
  form.hidden = false;
  form.addEventListener('submit', (e) => e.preventDefault());
  q.addEventListener('input', apply);
  cat.addEventListener('change', apply);
}
