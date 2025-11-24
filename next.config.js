/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Firebase modüllerinin client-side'da çalışması için
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // COEP header'ı WebRTC bağlantısını engelliyor, kaldırıldı
  // LiveKit WebRTC için COEP gerekli değil
};

module.exports = nextConfig;

