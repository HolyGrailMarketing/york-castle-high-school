# Placeholder images

Branded stand-ins for cards that have no usable photograph yet. **Every one of
these should be replaced with a real photograph of York Castle students.**

Regenerate with:

```bash
python3 scripts/generate-placeholders.py
```

Edit `scripts/generate-placeholders.py` to change the colours, icons or labels.
They are SVG, so they stay sharp at any size and each is roughly 1.5 KB.

## Why each one exists

| File | Used by | Replaced what |
|---|---|---|
| `basketball.svg` | Sports page | A stock wallpaper carrying a visible `www.DesktopBackground.org` watermark |
| `dance-and-speech.svg` | Clubs page | A photograph of the **Tivoli Dance Troupe** — a separate Kingston dance company, not York Castle students |
| `visual-arts.svg` | Clubs page | `download.webp` — generic clip art of unknown provenance |
| `iscf.svg` | Clubs page | `download_1.webp` — generic clip art of unknown provenance |
| `culinary-arts.svg` | Clubs page | `download-1.jpg` — generic clip art of unknown provenance |
| `tourism-action.svg` | Clubs page | `unnamed.webp` — generic clip art of unknown provenance |
| `environmental.svg` | Clubs page | `d0Ye30b-.webp` — generic clip art of unknown provenance |

The originals are still in `images/` and have not been deleted.

## Replacing one with a real photo

1. Drop the photograph into `images/` (landscape, ideally 1600px wide or more).
2. Point the card at it in `clubs.html` or
   `sports-and-extra-curricular-activities.html`.
3. On the clubs page, keep `class="club-card-media is-photo"` so the image
   fills the panel rather than being letterboxed like a logo.
4. Give it real `alt` text describing what is happening in the photograph.
5. Run `bash scripts/copy-static-files.sh` to sync `public/`.

## Note on the remaining logos

Affiliation badges that are legitimately the parent organisation's mark —
Kiwanis (Key Club), Rotary (Interact), the United Nations emblem and Optimist
International — are **not** placeholders and are correct to use as they are.
