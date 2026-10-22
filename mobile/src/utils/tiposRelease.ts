// Tradução dos tipos de versão (release_type) para português brasileiro.
// Os valores vêm do catálogo do banco em inglês; a interface exibe em pt-BR.
// Tipos desconhecidos são exibidos com o valor original, sem tradução
// inventada (Regra 2: nunca ocultar ou alterar versões).

const TIPOS_RELEASE_PT: Record<string, string> = {
  album: 'Álbum',
  single: 'Single',
  ep: 'EP',
  compilation: 'Coletânea',
  live: 'Ao vivo',
  remix: 'Remix',
  instrumental: 'Instrumental',
  demo: 'Demo',
  mixtape: 'Mixtape',
  soundtrack: 'Trilha sonora',
};

export function traduzirTipoRelease(tipo: string | null | undefined): string {
  if (!tipo) {
    return '';
  }
  const chave = tipo.trim().toLowerCase();
  return TIPOS_RELEASE_PT[chave] ?? tipo;
}
