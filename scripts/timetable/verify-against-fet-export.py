import re, json, html, sys
#!/usr/bin/env python3
"""
Prove the generated payload matches FET's own exported HTML, cell for cell.

This is the regression test for the parser: it reads FET's groups_days_horizontal
export, expands its rowspans, expands our own multi-period lessons, and compares
every (class, period, day) slot. Any difference is a parser bug.

At the time of writing it compares 23 classes / 622 cells with 0 discrepancies.

Keep this pointed at the export that came from the SAME .fet as the payload -
comparing across timetable versions will report differences that are real.

Usage:
    python3 scripts/timetable/verify-against-fet-export.py [path/to/groups_days_horizontal.html]
"""
import os
EXPORT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    '~/Downloads/YCHS_Timetable_2026-2027_Website/groups_days_horizontal.html')
src = open(EXPORT, encoding='utf-8-sig').read()
data = json.load(open('data/timetable-public.json'))
parsed = json.load(open('data/timetable-2026-2027.json'))
srclabel = {p['id']: p['sourceLabel'].strip() for p in parsed['periods']}
pidx = {p['id']: i for i,p in enumerate(parsed['periods'])}
order = [p['id'] for p in parsed['periods']]

def fet_cells(group):
    m = re.search(r'Group\s*<a href="#(table_\d+)">%s</a>' % re.escape(group), src)
    if not m: return None
    start = src.index('<table id="%s"' % m.group(1)); end = src.index('</table>', start)
    t = src[start:end]
    days = re.findall(r'<th class="xAxis">(.*?)</th>', t)
    rows = re.findall(r'<tr>(.*?)</tr>', t[t.index('<tbody>'):], re.S)
    periods = [html.unescape(re.search(r'<th class="yAxis">(.*?)</th>', r, re.S).group(1)).strip()
               for r in rows if re.search(r'<th class="yAxis">', r)]
    out = {}
    ri = -1
    for row in rows:
        if not re.search(r'<th class="yAxis">', row): continue
        ri += 1; col = 0
        for tok in re.finditer(r'<!-- span -->|<td([^>]*)>(.*?)</td>', row, re.S):
            if tok.group(0) == '<!-- span -->': col += 1; continue
            attrs, inner = tok.group(1), tok.group(2)
            sub = re.search(r'<span class="subject">(.*?)</span>', inner, re.S)
            if sub:
                tm = re.search(r'<div class="teacher line\d">(.*?)</div>', inner, re.S)
                # FET splits teacher lists on commas, and one teacher is named
                # "Salmon, J" - so compare the joined string, not the list.
                who = ' '.join(' '.join(html.unescape(tm.group(1)).split())
                               .replace(',', ' ').split()) if tm else ''
                span = int((re.search(r'rowspan="(\d+)"', attrs) or [0,'1'])[1])
                for k in range(span):                      # expand FET's rowspan
                    if ri+k < len(periods):
                        out[(periods[ri+k], days[col])] = (html.unescape(sub.group(1)).strip(), who)
            col += 1
    return out

def mine_cells(group):
    out = {}
    for l in data['lessons'][group]:
        day = data['days'][l['d']]
        who = ' '.join(' '.join(l.get('w', [])).split())
        for k in range(l.get('n',1)):                      # expand my duration
            out[(srclabel[order[pidx[l['p']]+k]], day)] = (l['t'], who)
    return out

groups = [g for y in data['years'] for g in y['groups']]
total_f = total_m = 0; bad = []
for g in groups:
    f = fet_cells(g)
    if f is None:
        # Grades 11-13 appear in the export as "<N> Automatic Group"
        f = fet_cells(g + ' Automatic Group')
    if f is None: bad.append((g,'NO FET TABLE',None,None)); continue
    m = mine_cells(g)
    total_f += len(f); total_m += len(m)
    for k in set(f) | set(m):
        if k not in f: bad.append((g,'extra',k,m[k]))
        elif k not in m: bad.append((g,'missing',k,f[k]))
        elif f[k][1] != m[k][1]:
            bad.append((g,'teachers',k,f'FET={f[k][1]!r} mine={m[k][1]!r}'))
print(f"classes compared: {len(groups)}")
print(f"FET export cells: {total_f}   my payload cells: {total_m}")
print("(subject titles are deliberately reworded; teacher lists are compared exactly)")
print(f"discrepancies: {len(bad)}")
if bad: sys.exit(1)
for b in bad[:25]: print("   ", b)
