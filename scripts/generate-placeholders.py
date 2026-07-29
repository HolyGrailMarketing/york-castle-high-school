#!/usr/bin/env python3
"""
Generate branded placeholder images for cards that have no usable photograph.

These stand in for images that were missing, or that could not be used because
they were clip art of unknown provenance or belonged to another organisation.
They are deliberately plain and on-brand rather than obviously "broken", but
every one of them should be replaced with a real photograph when the school has
one - see images/placeholders/README.md.

Output: images/placeholders/*.svg  (16:10, scales cleanly, ~2KB each)

Usage:  python3 scripts/generate-placeholders.py
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'images' / 'placeholders'

GOLD = '#d4af37'
CHARCOAL = '#1a1a1a'
DARK = '#2d2d2d'

# 24x24 line icons, drawn centred and scaled up by the template.
ICONS = {
    'basketball': (
        '<circle cx="12" cy="12" r="9"/>'
        '<path d="M12 3v18M3 12h18"/>'
        '<path d="M5.6 5.6a12 12 0 0 1 0 12.8M18.4 5.6a12 12 0 0 0 0 12.8"/>'
    ),
    'dance': (
        '<circle cx="9" cy="4.5" r="2"/>'
        '<path d="M9 7v5l-3 8M9 12l4 3 1 5"/>'
        '<path d="M9 9l5-2M9 9L4 8"/>'
    ),
    'palette': (
        '<path d="M12 3a9 9 0 0 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-8.6z"/>'
        '<circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="14.5" cy="7.5" r="1"/>'
    ),
    'book': (
        '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H5.5A2.5 2.5 0 0 1 3 15z"/>'
        '<path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5h5A2.5 2.5 0 0 0 21 15z"/>'
    ),
    'chef': (
        '<path d="M6 10a3.2 3.2 0 1 1 1.4-6.1 3.4 3.4 0 0 1 6.4-.5A3.2 3.2 0 1 1 18 10v1H6z"/>'
        '<path d="M6.5 13.5h11v5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z"/>'
    ),
    'globe': (
        '<circle cx="12" cy="12" r="9"/>'
        '<path d="M3 12h18"/>'
        '<path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>'
    ),
    'leaf': (
        '<path d="M4 20c0-8 5-14 16-15 1 10-4 15-11 15a6 6 0 0 1-5 0z"/>'
        '<path d="M9 15c2.5-3 5.5-4.5 8-5"/>'
    ),
}

TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-label="{label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{charcoal}"/>
      <stop offset="1" stop-color="{dark}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <g fill="none" stroke="{gold}" stroke-opacity="0.2" stroke-width="2">
    <path d="M-40 300 L240 20"/><path d="M40 380 L360 40"/><path d="M420 400 L680 120"/>
  </g>
  <circle cx="566" cy="64" r="132" fill="{gold}" fill-opacity="0.08"/>
  <circle cx="72" cy="352" r="76" fill="{gold}" fill-opacity="0.05"/>
  <g transform="translate(320 160) scale(5.4) translate(-12 -12)"
     fill="none" stroke="{gold}" stroke-width="1.3"
     stroke-linecap="round" stroke-linejoin="round">
    {icon}
  </g>
  <text x="320" y="300" text-anchor="middle"
        font-family="'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
        font-size="36" font-weight="600" fill="#ffffff">{label}</text>
  <text x="320" y="336" text-anchor="middle"
        font-family="'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
        font-size="15" letter-spacing="2.6" fill="{gold}" fill-opacity="0.8">{kicker}</text>
</svg>
'''

# (filename, label, kicker, icon)
PLACEHOLDERS = [
    ('basketball', 'Basketball', 'YORK CASTLE HIGH', 'basketball'),
    ('dance-and-speech', 'Dance &amp; Speech', 'CLUBS &amp; SOCIETIES', 'dance'),
    ('visual-arts', 'Visual Arts', 'CLUBS &amp; SOCIETIES', 'palette'),
    ('iscf', 'ISCF', 'CLUBS &amp; SOCIETIES', 'book'),
    ('culinary-arts', 'Culinary Arts', 'CLUBS &amp; SOCIETIES', 'chef'),
    ('tourism-action', 'Tourism Action', 'CLUBS &amp; SOCIETIES', 'globe'),
    ('environmental', 'Environmental', 'CLUBS &amp; SOCIETIES', 'leaf'),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, label, kicker, icon in PLACEHOLDERS:
        svg = TEMPLATE.format(
            label=label, kicker=kicker, icon=ICONS[icon],
            gold=GOLD, charcoal=CHARCOAL, dark=DARK,
        )
        path = OUT / f'{name}.svg'
        path.write_text(svg)
        print(f'  {path.relative_to(OUT.parent.parent)}  ({len(svg)} bytes)')
    print(f'\n{len(PLACEHOLDERS)} placeholders written to {OUT.relative_to(OUT.parent.parent)}/')


if __name__ == '__main__':
    main()
