// Funções utilitárias de uso técnico (tempo, tamanho, ids e temporização).

// Formatar tempo em milissegundos para mm:ss
export function formatTime(milliseconds: number): string {
  if (!milliseconds || milliseconds <= 0) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Formatar tamanho de arquivo em uma medida legível (ex: "1.5 MB")
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / Math.pow(1024, indice);
  return `${valor.toFixed(valor >= 10 || indice === 0 ? 0 : 1)} ${unidades[indice]}`;
}

// Debounce function
export function debounce<A extends unknown[]>(
  func: (...args: A) => void,
  wait: number
): (...args: A) => void {
  // ReturnType<typeof setTimeout> funciona sem depender dos tipos do Node
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
