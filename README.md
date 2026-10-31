# Dövlət Qulluğu — İmtahana Hazırlıq

Dövlət qulluğuna qəbulun test imtahanı (BA və BB qrupları) üçün interaktiv kitab: DİM proqramına uyğun fəsillər,
izahlı testlər, taymerli sınaq imtahanı, səhvlərin təkrarı, axtarış və irəliləyiş. Telefonda tətbiq kimi quraşdırılır
və internetsiz işləyir.

- **Offline tətbiq:** https://ilkinrzyv.github.io/dovlet-qullugu/ — telefonda aç və ana ekrana əlavə et.

Quraşdırma və məlumatların ixracı haqqında: [docs/README.md](docs/README.md).

## Repo-nun quruluşu

| Yer | Nə var |
|---|---|
| `book/book.md` | Kitabın əsas mətni (markdown) |
| `build/quiz/*.json` | Fəsil testləri |
| `build/fig/` | Şəkilli suallar üçün SVG fiqurlar |
| `build/proqram.json` | DİM-in 4 fənn üzrə proqramı (BA və BB mövzuları), imtahanın quruluşu və keçid balları |
| `build/parse_book.py` | `book.md` + testlər + proqram → `build/book.json` |
| `build/build_pwa.py` | `build/book.json` → `docs/` (sayt) |
| `build/app.js`, `build/app.css` | Tətbiqin interfeysi |
| `build/pwa.js`, `build/pwa.css`, `build/sw.template.js` | Offline rejim, quraşdırma, yeniləmə, ixrac/idxal |
| `build/make_icons.js`, `build/icons/` | Tətbiqin ikonları |
| `build/tp1.js`, `build/t1.js`, `build/test/` | Playwright yoxlamaları və onların yoxlama kitabı |
| `fonts/` | IBM Plex Sans, IBM Plex Mono, Literata |
| `docs/` | **Hazır sayt** — GitHub Pages buradan yayımlayır. Əl ilə dəyişmə, build ilə yaradılır. |

## Kitabın mətni necə yazılır

```markdown
# I hissə — Qanunvericilik {fənn=qan}

## Fəsil 1. Fəslin adı

Fəslin girişi (istəyə görə).

### 1.1. Bölmənin adı

Mətn, **qalın**, *kursiv*, siyahılar, cədvəllər.

> **Maddə 5.** Qanundan sitat.

## Fəsil 7. Yalnız BA proqramında olan mövzu {qrup=BA}
```

Başlığın sonundakı `{...}`:

- `fənn=qan` (`men`, `az`, `inf`) — hissənin fənni; fəsillər və onların sualları onu götürür, sınaq imtahanı sualları fənnə görə seçir.
- `qrup=BA` — fəsil və ya bölmə yalnız bu qrup üçündür (yazılmayıbsa, BA və BB). BB seçən oxucu onu görmür.
- `#c3x1` — sonradan əlavə olunan bölmənin öz id-si, ki, sonrakı bölmələrin irəliləyişi qarışmasın.

Fəsli proqramdakı mövzuya bağlamaq üçün `build/proqram.json`-da həmin mövzuya `"see": ["c1"]` yaz —
Proqram səhifəsi mövzunun yanında fəsli və oxunma vəziyyətini göstərəcək.

Testlər `build/quiz/` qovluğunda, fəslin nömrəsi ilə:

```json
{
"1": [
 {"s": "1.1", "q": "Sual?", "o": ["Düz cavab", "Səhv", "Səhv", "Səhv"], "a": 0, "e": "İzah"},
 {"s": "1.1", "t": "open", "q": "Açıq sual?", "a": ["30", "otuz"], "e": "İzah"},
 {"s": "1.2", "q": "Fiqurlu sual", "img": "men/001.svg", "fix": true, "o": ["A", "B", "C", "D", "E"], "a": 1}
]
}
```

- `s` — sualın aid olduğu bölmə, `e` — izah, `g` — qruplar (yazılmayıbsa, bölmədən götürülür).
- Qapalı sual: `o` — variantlar, `a` — düz variantın nömrəsi (0-dan). Qanunvericilikdə 4, digər fənlərdə 5 variant olmalıdır.
  Tətbiq variantları hər dəfə qarışdırır.
- Açıq sual (`"t": "open"`): `a` — qəbul olunan cavablar. Böyük-kiçik hərf, artıq boşluq və sondakı nöqtə nəzərə alınmır.
- Şəkilli sual: `img` — `build/fig/`-dəki SVG fayl. Variantlar şəkildəki hərflərdirsə, `"fix": true` yaz — sıra qarışmasın.

### Mətnin içində suallar: nümunə və yoxlama

Bölmənin mətnində izahdan sonra iki cür sual blokları yazılır:

````markdown
```nümunə
S: 2, 4, 6, ? — sual işarəsinin yerinə hansı ədəd gəlməlidir?
A) 7
B) 8
C) 9
D) 10
E) 12
Cavab: B
İzah: Hər ədəd əvvəlkindən **2** artıqdır: 6 + 2 = 8.
```

```yoxla
S: 3, 5, 7, ? — sual işarəsinin yerinə hansı ədəd gəlməlidir?
A) 8
B) 10
C) 9
D) 11
E) 12
Cavab: C
```

```yoxla
S: 1, 3, 5, ? (rəqəmlə yaz)
Cavab: 7 | yeddi
```
````

- `nümunə` — izahlı sual: tətbiq düz cavabı və `İzah:` hissəsini (həlli) göstərir.
- `yoxla` — izahsız yoxlama sualı: oxucu cavab verir, tətbiq yalnız “Düzdür / Səhvdir” deyir. `İzah:` yazılmır —
  çətinlikdə oxucu “Claude-dan kömək” düyməsini basır (Claude cavabı dərhal demədən ipucu verir).
- Variantsız blok açıq sualdır; `Cavab:` qəbul olunan cavabları `|` ilə ayırır. `Şəkil: men/001.svg` — fiqur.
- Variantların sırası qarışdırılmır (həll hərflərə istinad edə bilər). Variant sayı fənnə uyğun olmalıdır.
- **Məntiq** fəsillərində hər bölmədə hər izahdan sonra bir `nümunə`, onun ardınca ən azı bir `yoxla` gəlməlidir —
  parser bunu yoxlayır.
- Həll olunmuş yoxlama sualları yadda saxlanılır.

### Claude (virtual müəllim)

Tətbiqin “Müəllim” bölməsi, hər bölmənin altındakı “Claude-dan izah istə”, test izahları və yoxlama sualları
`https://claude.ai/new?q=...` keçidi ilə Claude-u açır: link hansı telefonda açılsa, orada daxil olunmuş Claude
hesabında yeni söhbət başlayır. Model göstərilmir — oxucu onu Claude-da özü seçir. Bu parametr Anthropic-in rəsmi
sənədlərində yoxdur, ona görə düymə sualı həm də buferə kopyalayır: Claude boş açılsa, mətni yapışdırmaq kifayətdir.
İnternet lazımdır.

## Dəyişiklik etmək

```bash
pip install -r requirements.txt
python build/parse_book.py     # book.md + testlər → build/book.json; "errors 0" olmalıdır
python build/build_pwa.py      # → docs/ (sayt) və dist/dovlet-qullugu-offline.zip
```

Yoxlama (Playwright, Chromium):

```bash
cd build && npm ci && npx playwright install chromium
npm run test:pwa    # real sayt: offline, quraşdırma, oxu, axtarış
npm run test:app    # yoxlama kitabı ilə: BA/BB süzgəci, proqram, açıq və şəkilli suallar, nümunə/yoxla blokları, Claude keçidləri, sınaq imtahanı
```

`docs/` qovluğunu commit edib push edəndə GitHub Pages saytı 1–2 dəqiqəyə yeniləyir. Quraşdırılmış
tətbiq növbəti açılışda yeni versiyanı yükləyir və “Yenilə” düyməsini göstərir.

## Lisenziyalar

Şriftlər: IBM Plex Sans, IBM Plex Mono, Literata — SIL Open Font License 1.1 (`fonts/*/package/LICENSE`).
