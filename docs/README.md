# Dövlət Qulluğu — offline tətbiq

Bu qovluq dövlət qulluğu imtahanlarına hazırlıq kitabının **offline tətbiq (PWA)** versiyasıdır. Bir dəfə
internetlə açandan sonra kitab, testlər və irəliləyiş **internetsiz** işləyir. Telefonda ana ekrana adi tətbiq
kimi quraşdırılır.

Versiya: `2026.10.31-c3d95b2` · cihazda tutduğu yer: təxminən 1,8 MB.

## Telefona quraşdır

- **Android (Chrome):** saytı aç → Ayarlar → “Tətbiqi quraşdır” və ya menyu (⋮) → “Ana ekrana əlavə et”.
- **iPhone, iPad (Safari):** saytı aç → Paylaş düyməsi → “Ana ekrana əlavə et”.

Ayarlar → Tətbiq bölməsində “Offline hazırdır” yazısı görünəndən sonra tətbiqi internetsiz də aça bilərsən.

## Məlumatların

- İrəliləyiş və test nəticələri yalnız bu cihazda saxlanılır.
- Ehtiyat nüsxə: Ayarlar → Məlumatlar → “İxrac et” (.json fayl). Yeni cihazda “İdxal et”.
- Brauzerin sayt məlumatlarını silsən, irəliləyiş də silinir — əvvəlcə ixrac et.

## Yeniləmə

Sayt yenilənəndə tətbiq növbəti açılışda yeni versiyanı yükləyir və “Yenilə” düyməsini göstərir. Məlumatların itmir.

## Fayllar

- `index.html` — tətbiqin qabığı
- `app.js`, `app.css` — interfeys
- `book.js` — kitabın bütün mətni və testlər
- `pwa.js` — offline rejim, quraşdırma, ixrac və idxal
- `sw.js` — service worker (offline yaddaş)
- `manifest.webmanifest`, `icons/` — tətbiqin adı və ikonları
- `fonts/` — IBM Plex Sans, IBM Plex Mono, Literata (SIL Open Font License 1.1)
