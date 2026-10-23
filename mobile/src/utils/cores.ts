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

// Lê qualquer token do tema (hex, hex com alfa ou rgb(a)) e devolve os canais.
function lerCanais(cor: string): { r: number; g: number; b: number; a: number } | null {
  const hex = cor.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    if ([r, g, b].some((valor) => Number.isNaN(valor))) return null;
    return { r, g, b, a };
  }

  const correspondencia = cor.match(/^rgba?\(([^)]+)\)$/i);
  if (!correspondencia) return null;

  const partes = correspondencia[1].split(',').map((parte) => parte.trim());
  if (partes.length < 3) return null;

  const canais = partes.slice(0, 3).map(Number);
  if (canais.some((valor) => Number.isNaN(valor))) return null;

  const alfa = partes.length > 3 ? Number(partes[3]) : 1;
  return {
    r: canais[0],
    g: canais[1],
    b: canais[2],
    a: Number.isNaN(alfa) ? 1 : alfa,
  };
}

// Compõe uma cor translúcida sobre um fundo e devolve um rgb opaco.
// Serve para derivar cores que precisam esconder o que está atrás (o campo de
// busca no navegador, por exemplo, precisa de uma cor totalmente opaca para
// encobrir o amarelo do preenchimento automático do navegador).
export function opacizar(cor: string, fundo: string): string {
  const frente = lerCanais(cor);
  const tras = lerCanais(fundo);
  if (!frente || !tras) return cor;

  const alfa = Math.max(0, Math.min(1, frente.a));
  const r = Math.round(frente.r * alfa + tras.r * (1 - alfa));
  const g = Math.round(frente.g * alfa + tras.g * (1 - alfa));
  const b = Math.round(frente.b * alfa + tras.b * (1 - alfa));
  return `rgb(${r}, ${g}, ${b})`;
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
