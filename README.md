# Dövlət Qulluğu — İmtahana Hazırlıq

Dövlət qulluğuna qəbul kursu və imtahanları üçün interaktiv kitab: fəsillər, izahlı testlər, səhvlərin təkrarı,
axtarış və irəliləyiş. Telefonda tətbiq kimi quraşdırılır və internetsiz işləyir.

- **Offline tətbiq:** https://ilkinrzyv.github.io/dovlet-qullugu/ — telefonda aç və ana ekrana əlavə et.

Quraşdırma və məlumatların ixracı haqqında: [docs/README.md](docs/README.md).

## Repo-nun quruluşu

| Yer | Nə var |
|---|---|
| `book/book.md` | Kitabın əsas mətni (markdown) |
| `build/quiz/*.json` | Fəsil testləri |
| `build/parse_book.py` | `book.md` + testlər → `build/book.json` |
| `build/build_pwa.py` | `build/book.json` → `docs/` (sayt) |
| `build/app.js`, `build/app.css` | Tətbiqin interfeysi |
| `build/pwa.js`, `build/pwa.css`, `build/sw.template.js` | Offline rejim, quraşdırma, yeniləmə, ixrac/idxal |
| `build/make_icons.js`, `build/icons/` | Tətbiqin ikonları |
| `build/tp1.js` | Playwright yoxlaması |
| `fonts/` | IBM Plex Sans, IBM Plex Mono, Literata |
| `docs/` | **Hazır sayt** — GitHub Pages buradan yayımlayır. Əl ilə dəyişmə, build ilə yaradılır. |

## Kitabın mətni necə yazılır

```markdown
# I hissə — Hissənin adı

## Fəsil 1. Fəslin adı

Fəslin girişi (istəyə görə).

### 1.1. Bölmənin adı

Mətn, **qalın**, *kursiv*, siyahılar, cədvəllər.

> **Maddə 5.** Qanundan sitat.
```

Testlər `build/quiz/` qovluğunda, fəslin nömrəsi ilə:

```json
{
"1": [
 {"s": "1.1", "q": "Sual?", "o": ["Düz cavab", "Səhv", "Səhv", "Səhv"], "a": 0, "e": "İzah"}
]
}
```

`s` — sualın aid olduğu bölmə, `o` — variantlar (2–6), `a` — düz variantın nömrəsi (0-dan), `e` — izah.
Tətbiq variantları hər dəfə qarışdırır.

## Dəyişiklik etmək

```bash
pip install -r requirements.txt
python build/parse_book.py     # book.md + testlər → build/book.json; "errors 0" olmalıdır
python build/build_pwa.py      # → docs/ (sayt) və dist/dovlet-qullugu-offline.zip
```

Yoxlama (Playwright, Chromium):

```bash
cd build && npm ci && npx playwright install chromium
npm run test:pwa    # offline, quraşdırma, oxu, test, axtarış
```

`docs/` qovluğunu commit edib push edəndə GitHub Pages saytı 1–2 dəqiqəyə yeniləyir. Quraşdırılmış
tətbiq növbəti açılışda yeni versiyanı yükləyir və “Yenilə” düyməsini göstərir.

## Lisenziyalar

Şriftlər: IBM Plex Sans, IBM Plex Mono, Literata — SIL Open Font License 1.1 (`fonts/*/package/LICENSE`).
