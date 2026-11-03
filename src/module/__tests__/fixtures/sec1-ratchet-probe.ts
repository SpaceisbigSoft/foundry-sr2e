// SEC1 second pass: patterns the HTML ratchet should flag. Each line puts an actor name into HTML unescaped.
const e = (s: string): string => s;
function escHtmlLater(s: string): string { return s; }
export function probes(actor: { name: string }, el: { innerHTML: string; insertAdjacentHTML(p: string, h: string): void }): string[] {
  const out: string[] = [];
  out.push(`<p>${'' + actor.name}</p>`);                     // P1 starts with a quote: "system constant"
  out.push(`<p>${e(actor.name)}</p>`);                        // P2 a function named e
  out.push(`<p>${escHtmlLater(actor.name)}</p>`);             // P3 name contains escHtml
  out.push(`<p>${actor.name.replace('&lt;', '<')}</p>`);      // P4 an UN-escaping replace
  out.push(`<p>${actor.name as 'L'}</p>`);                    // P5 cast to a literal type
  el.innerHTML = actor.name;                                   // P6 a sink with no template
  const t = `${actor.name}`; el.innerHTML = t;                 // P7 a markup-free template then a sink
  el.insertAdjacentHTML('beforeend', actor.name);              // P8 insertAdjacentHTML
  out.push('<b>' + actor.name + '</b>');                       // P9 control: concat (should be caught)
  out.push(`<p>${actor.name}</p>`);                            // P10 control (should be caught)
  return out;
}
