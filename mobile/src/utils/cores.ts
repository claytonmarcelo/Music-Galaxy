// Utilitários de cor usados pelo desenho de interfaces.
// Manter estas funções fora dos componentes evita repetição e permite
// derivar transparências de qualquer token do tema (hex ou rgba).

interface RGB {
  r: number;
  g: number;
  b: number;
}

// Lê um token hex (#RGB, #RRGGBB ou #RRGGBBAA) para componentes RGB.
function lerHex(cor: string): RGB | null {
  let hex = cor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((caractere) => caractere + caractere).join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((valor) => Number.isNaN(valor))) return null;
  return { r, g, b };
}

// Aplica transparência a um token, aceitando hex ou rgb(a).
export function comAlfa(cor: string, alfa: number): string {
  const intensidade = Math.max(0, Math.min(1, alfa));

  const rgb = lerHex(cor);
  if (rgb) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensidade})`;
  }

  const correspondencia = cor.match(/^rgba?\(([^)]+)\)$/i);
  if (correspondencia) {
    const partes = correspondencia[1].split(',').map((parte) => parte.trim());
    if (partes.length >= 3) {
      return `rgba(${partes[0]}, ${partes[1]}, ${partes[2]}, ${intensidade})`;
    }
  }

  return cor;
}

// Mistura duas cores hex em uma proporção de 0 a 1.
// Usada para desenhar o degradê de fundo com faixas nativas do React Native.
export function misturarCores(origem: string, destino: string, proporcao: number): string {
  const a = lerHex(origem);
  const b = lerHex(destino);
  if (!a || !b) return destino;

  const t = Math.max(0, Math.min(1, proporcao));
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
