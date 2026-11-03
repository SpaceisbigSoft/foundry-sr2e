"""v0.89.0: move the settings' names, hints, menu labels and choice labels into lang/en.json (SR2E.Settings.<key>.*).
Foundry translates these fields itself. Run once: python3 scripts/i18n-settings.py <files...>"""
import json, re, sys
LANG = 'public/lang/en.json'
lang = json.load(open(LANG, encoding='utf8'))
S = lang['SR2E'].setdefault('Settings', {})
STR = r'(?:"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\')'
def unq(a, b=None):
    if a is not None: return json.loads('"' + a + '"')
    return b.replace("\\'", "'").replace('\\\\', '\\')
total = 0
for path in sys.argv[1:]:
    src = open(path, encoding='utf8').read()
    out = []; i = 0
    for m in re.finditer(r'(?:settings|\bs)\.register(Menu)?\(\s*(?:SYSTEM\.id|SYSTEM_ID|ID|SYS)\s*,\s*([\'"])(\w+)\2\s*,\s*\{', src):
        key = m.group(3)
        start = m.end() - 1
        # the object literal's end (balanced braces, skipping strings)
        depth = 0; j = start; q = None
        while j < len(src):
            c = src[j]
            if q:
                if c == '\\': j += 2; continue
                if c == q: q = None
            elif c in '"\'`': q = c
            elif c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0: break
            j += 1
        body = src[start:j + 1]
        entry = S.setdefault(key, {})
        def field(fm):
            global total
            f, v = fm.group(1), unq(fm.group(2), fm.group(3))
            if v.startswith('SR2E.'): return fm.group(0)  # already a key (a second run)
            k = {'name': 'Name', 'hint': 'Hint', 'label': 'Label'}[f]
            entry[k] = v; total += 1
            return f'{f}: "SR2E.Settings.{key}.{k}"'
        body2 = re.sub(r'\b(name|hint|label):\s*' + STR, field, body)
        def choices(cm):
            global total
            inner = cm.group(1)
            if '...' in inner: return cm.group(0)
            ch = entry.setdefault('Choices', {})
            def one(om):
                global total
                ch[om.group(1)] = unq(om.group(2), om.group(3)); total += 1
                return f'{om.group(1)}: "SR2E.Settings.{key}.Choices.{om.group(1)}"'
            return 'choices: {' + re.sub(r'(\w+):\s*' + STR, one, inner) + '}'
        body2 = re.sub(r'choices:\s*\{([^{}]*)\}', choices, body2)
        if not entry: S.pop(key)
        out.append(src[i:start]); out.append(body2); i = j + 1
    out.append(src[i:])
    open(path, 'w', encoding='utf8').write(''.join(out))
json.dump(lang, open(LANG, 'w', encoding='utf8'), indent=2, ensure_ascii=False); open(LANG, 'a').write('\n')
print('strings', total, 'settings', len(S))
