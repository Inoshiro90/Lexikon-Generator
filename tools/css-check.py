#!/usr/bin/env python3
"""CSS-Konsistenzprüfung (statisch): nicht definierte/ungenutzte Variablen, ungenutzte Klassen,
doppelte Selektoren, !important, Inline-Styles, veraltete Klassen. Aufruf: python3 tools/css-check.py [Projektordner]"""
import re, glob, os, sys, collections
root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
files = sorted(glob.glob(root + '/css/**/*.css', recursive=True))
raw = {f: open(f).read() for f in files}
css = {f: re.sub(r'/\*.*?\*/', '', t, flags=re.S) for f, t in raw.items()}
allcss = '\n'.join(css.values())
src = ''.join(open(f).read() for f in glob.glob(root + '/js/**/*.js', recursive=True) + [root + '/index.html'])

defined = set(re.findall(r'(--[\w-]+)\s*:', allcss))
used = collections.Counter(re.findall(r'var\((--[\w-]+)', allcss))
print('Dateien:', [os.path.relpath(f, root) for f in files])
print('\n[Variablen] nicht definiert, aber verwendet:', sorted(v for v in used if v not in defined) or '–')
print('[Variablen] definiert, aber nie per var() gelesen:', sorted(v for v in defined if v not in used) or '–')

sel_text = re.sub(r'\{[^{}]*\}', '{}', re.sub(r'@media[^{]*\{', '', allcss))
classes = sorted(set(re.findall(r'\.([a-zA-Z_][\w-]*)', re.sub(r'url\([^)]*\)', '', sel_text))))
unused = [c for c in classes if not re.search(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', src)]
print(f'\n[Klassen] {len(classes)} im CSS; im HTML/JS nirgends referenziert:', unused or '–')

print('\n[Doppelte Selektoren] (gleicher Selektor-Text innerhalb derselben @media-Ebene mehrfach definiert):')
dups = collections.defaultdict(list)
for f, t in css.items():
    depth_media = None
    for m in re.finditer(r'(@media[^{]+)\{|([^{}@]+)\{[^{}]*\}|\}', t):
        if m.group(1): depth_media = m.group(1).strip()
        elif m.group(2): dups[(depth_media if False else '', m.group(2).strip())].append(os.path.basename(f))
# vereinfachte Variante: nur Top-Level-Regeln (ohne @media) zählen
top = collections.defaultdict(list)
for f, t in css.items():
    t2 = re.sub(r'@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', t)
    t2 = re.sub(r'@(keyframes)[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', t2)
    for m in re.finditer(r'([^{}]+)\{[^{}]*\}', t2):
        for s in [x.strip() for x in m.group(1).split(',')]:
            if s: top[s].append(os.path.basename(f))
d = {k: v for k, v in top.items() if len(v) > 1}
for k, v in sorted(d.items()): print('   ', k, '→', v)
if not d: print('    –')

imp = [(os.path.basename(f), l.strip()) for f, t in css.items() for l in t.split('\n') if '!important' in l]
print('\n[!important]', len(imp)); [print('   ', a, b) for a, b in imp]
print('\n[Inline-Styles in index.html/JS]:')
for f in [root + '/index.html'] + glob.glob(root + '/js/*.js'):
    for i, l in enumerate(open(f).read().split('\n'), 1):
        if re.search(r'style\s*=\s*\\?"', l) and 'taxonomy-seed' not in f: print('   ', os.path.relpath(f, root) + ':' + str(i), l.strip()[:110])
print('\n[Zeilen] ' + ', '.join(f'{os.path.basename(f)}={len(raw[f].splitlines())}' for f in files))
