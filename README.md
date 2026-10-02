# Country Quiz

Ülkeler, başkentler, şehirler, bayraklar ve ülke istatistikleri üzerine bir web tabanlı quiz oyunu. Arayüz Türkçedir; oyun React, TypeScript ve Vite ile geliştirilmiştir.

## Özellikler

- **Başkent Yazma:** Gösterilen ülkenin başkentini yaz.
- **Ülke Adı Yazma:** Haritada işaretlenen ülkeleri bul.
- **Şehir Yazma:** Şehir adlarını ülke haritasıyla eşleştir.
- **Bayraktan Ülke (Yazarak):** Bayrağı görüp ülke adını yaz; tek oyunculu veya aynı cihazda iki oyunculu oyna.
- **Bayraktan Ülke (4 Şıklı):** Bayrağa karşılık gelen ülkeyi seçeneklerden bul.
- **Ülke Karşılaştırması:** Tek oyunculu, yerel iki oyunculu veya online oda ile oyna. Her turda ülke, ölçüt ve yön oyunun kullanılabilir verilerine göre rastgele seçilir; geçerli cevabı olmayan soru üretilmez.
- Ülke haritası, kullanılan cevap listeleri, skor ve oyun süresi.
- Ekran boyutuna uyumlu arayüz ve harita yakınlaştırma kontrolleri.

Bayrak görselleri SVG olarak FlagCDN'den yüklenir. Görsel yüklenemezse emoji yedeği gösterilir; emoji görünümü cihazın yazı tipi desteğine bağlı olabilir.

## Gereksinimler

- Node.js ve npm
- Online oyun odaları için bir Supabase projesi

## Kurulum ve çalıştırma

```bash
npm install
npm run dev
```

Vite geliştirme sunucusu terminalde bir yerel adres gösterir. Üretim derlemesi ve lint kontrolü:

```bash
npm run build
npm run lint
```

## Supabase kurulumu

Supabase yalnızca online oda oyunları için gereklidir. Yerel oyun modları Supabase ortam değişkenleri olmadan da çalışır.

1. Supabase projesi oluştur ve Authentication ayarlarından **Anonymous sign-ins** özelliğini etkinleştir.
2. Yeni veritabanında önce `supabase/schema.sql` dosyasını bir kez çalıştır.
3. Mevcut oda işlevleri ve düzeltmeleri için `supabase/migrations/` içindeki migration dosyalarını tarih sırasıyla çalıştır. `country-compare` online oda desteği için `202609290001_country_compare_online_mode.sql` migration'ı da uygulanmalıdır.
4. Proje kökünde `.env.local` oluştur ve Supabase proje URL'siyle publishable key değerlerini gir:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

5. Geliştirme sunucusunu yeniden başlat.

Oda oluşturma, odaya katılma, cevap kaydetme ve sıra geçirme işlemleri veritabanı RPC fonksiyonları üzerinden yapılır. Oda tablolarında RLS etkin olmalıdır; migration'ları atlamayın.

## Ülke ve şehir verileri

- Ülke listesi ve ülke kodları `world-countries` paketinden gelir.
- Nüfus, GSYİH ve kişi başı GSYİH verileri `src/data/countryStats.ts` içinde tutulur. Bu dosyayı World Bank API'sinden yenilemek için:

  ```bash
  npm run data:update
  ```

- Yüzölçümü `world-countries` verisinden alınır.
- Şehir ipuçları `src/cities.ts` içinde üretilmiş veridir. Kaynak `worldcities.csv` dosyasını değiştirdiğinde yeniden oluşturmak için:

  ```bash
  npm run cities:generate
  ```

Üretilen dosyaları doğrudan elle düzenlemek yerine ilgili üretim komutunu ve kaynak veriyi güncelle.

## Proje yapısı

```text
src/
  App.tsx                       Oyun menüsü ve ekranları
  WorldMap.tsx                  Dünya haritası bileşeni
  countries.ts                  Ülke verisi yükleme
  targets.ts                    Oyun hedeflerini oluşturma
  use*Game.ts                   Oyun durumları ve kuralları
  onlineRooms.ts                Supabase oda işlemleri
  data/countryStats.ts          Ülke istatistikleri
supabase/
  schema.sql                    Yeni veritabanı başlangıç şeması
  migrations/                   Sıralı SQL güncellemeleri
scripts/                        Veri üretme ve güncelleme komutları
```

## README güncelliği

Yeni bir oyun modu, önemli arayüz davranışı, online/Supabase değişikliği, ortam değişkeni veya geliştirme komutu eklendiğinde bu README'yi aynı değişiklik içinde güncelle. Özellik listesini, kurulum adımlarını ve ilgili komutları güncel tut; artık geçerli olmayan açıklamaları kaldır.
