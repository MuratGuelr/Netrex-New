/**
 * Yerel avatar oluşturucu - COEP hatası olmadan çalışır
 */
export function generateAvatar(name: string, size: number = 40): string {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    '#5865F2', // Discord mavi
    '#57F287', // Yeşil
    '#FEE75C', // Sarı
    '#EB459E', // Pembe
    '#ED4245', // Kırmızı
    '#F37B20', // Turuncu
    '#9C84EF', // Mor
    '#00D166', // Açık yeşil
  ];

  // İsme göre renk seç (deterministic)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const backgroundColor = colors[colorIndex];

  // SVG oluştur
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size / 2}"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.4}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >${initials}</text>
    </svg>
  `.trim();

  // Data URL'e dönüştür
  if (typeof window !== 'undefined' && typeof btoa !== 'undefined') {
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  // SSR fallback - base64 encoding olmadan
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

