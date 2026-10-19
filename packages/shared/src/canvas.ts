export interface CanvasInput {
  readonly title: string;
  readonly sections: ReadonlyArray<{
    readonly title: string;
    readonly summary: string;
    readonly metrics?:
      | ReadonlyArray<{ readonly label: string; readonly value: string }>
      | undefined;
    readonly flow?: ReadonlyArray<string> | undefined;
    readonly columns?: ReadonlyArray<string> | undefined;
    readonly rows?: ReadonlyArray<ReadonlyArray<string>> | undefined;
  }>;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

/** Bounded, decoded sections become offline HTML; content never becomes executable markup. */
export function buildCanvasDocument(input: CanvasInput) {
  const tabs = input.sections
    .map(
      (section, i) =>
        `<button role="tab" id="tab-${i}" aria-controls="pane-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${i}">${escapeHtml(section.title)}</button>`,
    )
    .join("");
  const panes = input.sections
    .map((section, i) => {
      const metrics = (section.metrics ?? [])
        .map(
          (metric) =>
            `<div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`,
        )
        .join("");
      const flow = (section.flow ?? [])
        .map(
          (step, n) =>
            `<g transform="translate(0 ${n * 64})"><rect x="20" y="4" width="360" height="40" rx="12"/><text x="200" y="29" text-anchor="middle">${escapeHtml(step)}</text>${n + 1 < section.flow!.length ? '<path d="M200 44v20m-5-6 5 6 5-6"/>' : ""}</g>`,
        )
        .join("");
      const table = section.columns?.length
        ? `<div class="table-wrap"><table><thead><tr>${section.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${(section.rows ?? []).map((row) => `<tr>${section.columns!.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
        : "";
      return `<section role="tabpanel" id="pane-${i}" aria-labelledby="tab-${i}" aria-hidden="${i !== 0}" ${i === 0 ? 'data-active="true"' : ""}><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.summary)}</p>${metrics ? `<div class="metrics">${metrics}</div>` : ""}${flow ? `<svg role="img" aria-label="${escapeHtml(section.title)} flow" viewBox="0 0 400 ${section.flow!.length * 64}" class="flow">${flow}</svg>` : ""}${table}</section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title><style>
*{box-sizing:border-box}body{margin:0;padding:0;color:var(--foreground);font:15px/1.6 var(--font-sans);overflow-wrap:anywhere}h1{margin:18px 0;font-size:clamp(24px,5vw,36px);line-height:1.2}h2{font-size:20px}p{color:var(--muted-foreground)}nav{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:16px;border-bottom:1px solid var(--border)}button{border:1px solid var(--border);border-radius:999px;padding:10px 16px;background:var(--card);color:var(--foreground);font:inherit;cursor:pointer}button[aria-selected=true]{border-color:var(--primary);box-shadow:0 0 14px color-mix(in srgb,var(--primary) 20%,transparent)}button:focus-visible{outline:2px solid var(--ring);outline-offset:3px}.panes{display:grid}.panes>section{grid-area:1/1;visibility:hidden;min-width:0}.panes>section[data-active]{visibility:visible}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px;margin:20px 0}.metric{padding:16px;border:1px solid var(--border);border-top:2px solid var(--primary);border-radius:var(--radius);background:var(--card)}.metric span{display:block;color:var(--muted-foreground);font-size:13px}.metric strong{display:block;font-size:24px;font-family:var(--font-mono)}.flow{display:block;width:min(100%,400px);margin:20px auto}.flow rect{fill:var(--card);stroke:var(--border)}.flow text{fill:var(--foreground);font:14px var(--font-sans)}.flow path{fill:none;stroke:var(--primary);stroke-width:2}.table-wrap{overflow-x:auto}table{width:100%;min-width:480px;border-collapse:collapse;font-size:14px}th,td{padding:12px;overflow-wrap:normal;text-align:left;border-bottom:1px solid var(--border)}th{color:var(--muted-foreground)}tbody tr:nth-child(odd){background:var(--muted)}@media(max-width:480px){body{padding:0}button{padding:10px 12px}}
</style></head><body><nav role="tablist" aria-label="Canvas sections">${tabs}</nav><div class="panes">${panes}</div><script>
const tabs=[...document.querySelectorAll('[role=tab]')],panes=[...document.querySelectorAll('[role=tabpanel]')];function select(i,focus){tabs.forEach((tab,n)=>{tab.setAttribute('aria-selected',String(n===i));tab.tabIndex=n===i?0:-1});panes.forEach((pane,n)=>{pane.toggleAttribute('data-active',n===i);pane.setAttribute('aria-hidden',String(n!==i))});if(focus)tabs[i].focus()}tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(i,false));tab.addEventListener('keydown',e=>{let n=i;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();select(n,true)})});
</script></body></html>`;
}
