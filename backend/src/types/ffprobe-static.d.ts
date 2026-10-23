// Declaração de tipos para ffprobe-static (o pacote não traz tipos próprios).
// Exporta um objeto com a propriedade `path` — caminho absoluto do binário ffprobe embutido.
declare module 'ffprobe-static' {
  export const path: string;
}
