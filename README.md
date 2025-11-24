# Chatify - Discord Benzeri Sohbet Uygulaması

Next.js 14+ ve Firebase ile geliştirilmiş, Discord benzeri modern sohbet uygulaması. Metin kanalları, sesli kanallar ve gerçek zamanlı mesajlaşma özellikleri.

## Özellikler

- 🔐 Google ile giriş (Firebase Authentication)
- 💬 Gerçek zamanlı mesajlaşma (Firestore)
- 🎤 Sesli kanallar (LiveKit ile)
- 📁 Kanal yönetimi (Metin ve Sesli kanallar)
- 👥 Kullanıcı listesi (Online/Offline durumu)
- 🎨 Modern Discord benzeri koyu tema UI
- 📱 Responsive tasarım
- 🚀 Vercel'de sorunsuz çalışır

## Teknolojiler

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth (Google)
- **Voice:** LiveKit
- **Styling:** Tailwind CSS
- **Icons:** Font Awesome

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. Yeni proje oluşturun
3. Authentication'ı etkinleştirin (Google provider)
4. Firestore Database'i oluşturun
5. Firestore güvenlik kurallarını `firestore.rules` dosyasından kopyalayın

### 3. LiveKit Cloud Hesabı Oluştur

1. https://cloud.livekit.io adresine gidin
2. Ücretsiz hesap oluştur
3. Yeni proje oluştur
4. Dashboard'dan API bilgilerini al

### 4. Environment Variables

Proje root'unda `.env.local` dosyası oluşturun:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

**ÖNEMLİ:** `.env.local` dosyasını oluşturmadan uygulama çalışmayacaktır!

### 5. Firestore Güvenlik Kuralları

Firebase Console'da Firestore Database > Rules sekmesine gidin ve `firestore.rules` dosyasındaki kuralları yapıştırın.

### 6. Uygulamayı Başlat

```bash
npm run dev
```

Tarayıcıda http://localhost:3000 adresine gidin.

## Vercel'e Deploy

### 1. GitHub'a Push Et

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Vercel'e Import Et

1. [Vercel](https://vercel.com) hesabınıza giriş yapın
2. "New Project" butonuna tıklayın
3. GitHub repository'nizi seçin
4. "Import" butonuna tıklayın

### 3. Environment Variables Ekle

Vercel proje ayarlarında "Environment Variables" sekmesine gidin ve şu değişkenleri ekleyin:

**Firebase Configuration:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

**LiveKit Configuration:**
- `LIVEKIT_API_KEY` (Server-side, gizli tutulmalı)
- `LIVEKIT_API_SECRET` (Server-side, gizli tutulmalı)
- `NEXT_PUBLIC_LIVEKIT_URL` (Client-side, public olabilir)

**ÖNEMLİ:** 
- `LIVEKIT_API_KEY` ve `LIVEKIT_API_SECRET` sadece Production environment'ına ekleyin
- Tüm `NEXT_PUBLIC_*` değişkenleri hem Production hem de Preview environment'larına ekleyin

### 4. Build Ayarları

Vercel otomatik olarak Next.js projesini algılayacaktır. Eğer sorun yaşarsanız:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (otomatik)
- **Output Directory:** `.next` (otomatik)
- **Install Command:** `npm install` (otomatik)

### 5. Deploy Et

"Deploy" butonuna tıklayın. İlk deploy birkaç dakika sürebilir.

### 6. Sorun Giderme

Eğer deploy sırasında hata alırsanız:

1. **Environment Variables eksik:** Tüm gerekli değişkenlerin eklendiğinden emin olun
2. **Build hatası:** Vercel build loglarını kontrol edin
3. **Runtime hatası:** Vercel function loglarını kontrol edin
4. **API hatası:** `/api/token` endpoint'inin çalıştığından emin olun

### 7. Custom Domain (Opsiyonel)

Vercel dashboard'dan "Settings" > "Domains" sekmesinden custom domain ekleyebilirsiniz.

## Kullanım

1. **Giriş**: Google hesabınızla giriş yapın
2. **Kanal Oluştur**: Sol taraftan "+" butonuna tıklayarak metin veya sesli kanal oluşturun
3. **Mesajlaş**: Metin kanallarında mesaj gönderin
4. **Sesli Kanala Katıl**: Sesli kanalı seçip sesli sohbete katılın

## Firestore Yapısı

- `users/{userId}` - Kullanıcı bilgileri
- `channels/{channelId}` - Kanallar (type: 'text' | 'voice' | 'dm')
- `channels/{channelId}/messages/{messageId}` - Mesajlar
- `channels/{channelId}/typing/{userId}` - Yazma durumu

## Lisans

MIT
