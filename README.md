# Dövlət Qulluğu — İmtahana Hazırlıq

Dövlət qulluğuna qəbulun test imtahanı (BA və BB qrupları) üçün interaktiv kitab: DİM proqramına uyğun fəsillər,
qanunların tam rəsmi mətni, izahlı testlər (izahdakı maddə kitabda açılır), taymerli sınaq imtahanı, səhvlərin təkrarı,
əlfəcinlər, axtarış və irəliləyiş. Telefonda tətbiq kimi quraşdırılır və internetsiz işləyir.

- **Offline tətbiq:** https://ilkinrzyv.github.io/dovlet-qullugu/ — telefonda aç və ana ekrana əlavə et.

Quraşdırma və məlumatların ixracı haqqında: [docs/README.md](docs/README.md).

## Repo-nun quruluşu

| Yer | Nə var |
|---|---|
| `book/book.md` | Kitabın əsas mətni (markdown) |
| `build/quiz/*.json` | Fəsil testləri |
| `build/fig/` | Şəkilli suallar üçün SVG fiqurlar |
| `build/figs_men.py` | Məntiq fiqurlarını çəkir (`build/fig/men/`), cavablarını hesablayıb yoxlayır və `answers.json`-a yazır — parser hər şəkilli sualın cavabını onunla tutuşdurur |
| `build/proqram.json` | DİM-in 4 fənn üzrə proqramı (BA və BB mövzuları), imtahanın quruluşu və keçid balları |
| `build/qanun.py`, `build/qanun/*.json` | Qanunvericilik hissəsinin mətni: skript qanunları e-qanun.az-dan endirir və maddələrə bölür (ləğv olunmuş mətn atılır) |
| `build/parse_book.py` | `book.md` + testlər + proqram → `build/book.json` |
| `build/build_pwa.py` | `build/book.json` → `docs/` (sayt) |
| `build/app.js`, `build/app.css` | Tətbiqin interfeysi |
| `build/pwa.js`, `build/pwa.css`, `build/sw.template.js` | Offline rejim, quraşdırma, yeniləmə, ixrac/idxal |
| `build/make_icons.js`, `build/icons/` | Tətbiqin ikonları |
| `build/tp1.js`, `build/t1.js`, `build/test/` | Playwright yoxlamaları və onların yoxlama kitabı |
| `fonts/` | Plus Jakarta Sans |
| `docs/` | **Hazır sayt** — GitHub Pages buradan yayımlayır. Əl ilə dəyişmə, build ilə yaradılır. |

## Kitabın mətni necə yazılır

```markdown
# I hissə — Qanunvericilik {fənn=qan}

## Fəsil 1. Fəslin adı

Fəslin girişi (istəyə görə).

### 1.1. Bölmənin adı

Mətn, **qalın**, *kursiv*, siyahılar, cədvəllər.

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

### Qanun mətni: `qanun` bloku

Qanunvericilik fəsillərində qanunun mətni əl ilə yazılmır: `qanun` bloku hansı maddələrin göstəriləcəyini deyir,
mətni isə parser `build/qanun/<akt>.json`-dan (e-qanun.az-dakı rəsmi mətn) olduğu kimi götürür:

````markdown
```qanun konstitusiya
mənbə
preambula
maddə 1–6
```

```qanun nha
maddə 1: 1.0 1.0.1–1.0.4
maddə 17–20
```
````

- Hər sətir bir seçimdir: `maddə 5`, `maddə 5–9` (aralıq uzun tire ilə; `13-1` bir maddənin nömrəsidir),
  `maddə 1: 1.0.1 1.0.3` (maddədən yalnız bu bəndlər), `bənd 33–34`, `hissə 1–3` (Təlimatın hissələri),
  `fərman bənd 3`, `preambula`, `keçid müddəaları`, `mənbə` (mətnin mənbəyi və tarixi).
- Bölmə, fəsil və hissə başlıqları seçim onlardan başlayanda özü əlavə olunur; ləğv olunmuş maddə “çıxarılıb” kimi
  göstərilir.
- Hər maddənin (Təlimatda bəndin) kitabda öz ünvanı var: `#konstitusiya-m72`, `#karguzarliq-b25`. Ona görə bir maddə
  yalnız bir bölmədə göstərilə bilər — parser bunu yoxlayır. Uzun qanun bölməsinin başında maddələrin siyahısı çıxır.
- Test izahında “Maddə 72.III”, “Konstitusiyanın 109-cu maddəsi”, “Bənd 25” yazılanda tətbiq onu həmin maddəyə
  keçidə çevirir. Qanunun adı yazılmayıbsa, sualın öz bölməsinin qanunu götürülür; kitabda olmayan maddə keçidsiz qalır.
- Aktların siyahısı (`konstitusiya`, `dovlet-qullugu`, `nha` və s.) `build/qanun.py`-dakı `ACTS`-dadır.
- Qanuna dəyişiklik ediləndə: `python build/qanun.py` — mətnlər yenidən endirilir; `git diff build/qanun` nəyin
  dəyişdiyini göstərir. Sonra testlərin və “Yadda saxla” cədvəllərinin hələ də düz olduğunu yoxla.

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

Hər bölmənin altındakı “Claude-dan izah istə”, test izahları, nümunə və yoxlama sualları — Claude cavabı düymənin
altında, kitabın içində yazır. “Müəllim” bölməsi istənilən mövzuda sadə söhbətdir; söhbət boş olanda hazır məsləhət
mövzuları (hazırlıq planı, zəif yerlər, müsahibə və s.) təklif olunur.

- **claude.ai versiyası** (https://claude.ai/artifact/DS1Sg1NBATqkMRPuVkHoER) — Claude oxucunun öz claude.ai hesabı
  ilə işləyir; ilk dəfə claude.ai icazə soruşur. Başqası açsın deyə səhifəni Paylaş menyusundan linklə paylaş.
- **Oflayn tətbiq** — Ayarlar → Claude bölməsində öz Anthropic API açarını əlavə etsən, cavab tətbiqdə yazılır.
  Açar yalnız bu cihazda saxlanılır və yalnız api.anthropic.com-a göndərilir. Açar yoxdursa, düymə claude.ai
  versiyasında eyni yeri açır və Claude cavaba orada özü başlayır (yazdığın sual buferə kopyalanır).
- Modeli oxucu seçir (Ayarlar → Claude): Avtomatik, Opus, Sonnet, Haiku. İnternet lazımdır.

claude.ai versiyasını yeniləmək: `python build/build_page.py` → `dist/dovlet-qullugu.html`, sonra eyni artifakta
yenidən dərc et.

## Dəyişiklik etmək

```bash
pip install -r requirements.txt
python build/qanun.py          # yalnız qanunlar dəyişəndə: rəsmi mətnlər e-qanun.az-dan → build/qanun/
python build/parse_book.py     # book.md + testlər → build/book.json; "errors 0" olmalıdır
python build/build_pwa.py      # → docs/ (sayt) və dist/dovlet-qullugu-offline.zip
```

Yoxlama (Playwright: Chromium, iPhone üçün WebKit):

```bash
cd build && npm ci && npx playwright install chromium webkit
npm run test:pwa    # real sayt: offline, quraşdırma, oxu, axtarış, maddə siyahısı və izahdakı keçidlər, yeni versiya bildirişi (Chromium, iPhone — Safari və ana ekran)
npm run test:app    # yoxlama kitabı ilə: BA/BB süzgəci, proqram və onun sekmələri, açıq və şəkilli suallar, nümunə/yoxla blokları, Claude (API açarı ilə), sınaq imtahanı, qanun mətni, izahdan maddəyə keçid və testə qayıtma, əlfəcinlər, qaldığın yerdən davam
npm run test:page   # claude.ai versiyası: #ai-… keçidləri cavabı özü başladır, model seçimi
```

`docs/` qovluğunu commit edib push edəndə GitHub Pages saytı 1–2 dəqiqəyə yeniləyir. Quraşdırılmış
tətbiq yeni versiyanı özü axtarır — açılanda, ekrana qayıdanda, internet bərpa olanda və açıq qaldıqca yarım
saatdan bir — və yükləyəndən sonra özü keçir: oxucu tətbiqdən çıxıb qayıdanda yeni versiya eyni yerdə açılır.
Yarımçıq test və ya söhbət varsa, gözləyir; o vaxta qədər ekranda “Yenilə” bildirişi durur.

## Lisenziyalar

Şrift: Plus Jakarta Sans — SIL Open Font License 1.1 (`fonts/*/package/LICENSE`).
Kitabxanalar: marked 12.0.2 (MIT), DOMPurify 3.1.6 (Apache-2.0 / MPL-2.0) — `libs/*/LICENSE*`.
