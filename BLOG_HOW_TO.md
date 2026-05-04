Absolute paths — perfect, will work regardless of nesting depth. Done. Here's a summary of everything that was built:

---

**What was built — zero breaking changes:**

### New files
| Path | What it is |
|------|------------|
| `blog/index.html` | Blog listing page — featured latest article + grid of cards (including "coming soon" placeholders for next 2 articles) |
| `blog/articles/how-app-store-algorithm-works/index.html` | Full article page with reading progress bar, callout boxes, code comparison blocks, CTA, breadcrumbs, tags |

### Patched files (minimal, surgical)
| File | Change |
|------|--------|
| `index.html` | Added **Blog** link to desktop nav, mobile nav overlay, and footer |
| `sitemap.xml` | Added both new URLs with correct priorities |

### How to add the next article
1. Create `blog/articles/<slug>/index.html` (copy the article page template)
2. Update `blog/index.html` — change the "coming soon" card to a real link + bump the article count
3. Add the URL to `sitemap.xml`

### Direct links
- Blog index → `https://www.cristomade.it/blog/`
- First article → `https://www.cristomade.it/blog/articles/how-app-store-algorithm-works/`

These are the URLs to share externally whenever you link to content. The blog index URL is safe to pin in social bios, newsletters, etc. — it'll always show the latest post first.

