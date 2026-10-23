// Regra 8 — Nomes oficiais de músicas, artistas e bandas.
// Todo nome que vem de uma fonte externa (MusicBrainz, Discogs) chega ao banco
// exatamente como a fonte oficial o publica: mesma grafia, mesmos acentos,
// mesmas maiúsculas e minúsculas, mesmos sinais (AC/DC, deadmau5, Björk).
// Este módulo é o único lugar autorizado a tocar nesse texto — e só para
// ajustar espaços em branco. Nada de abreviar, "corrigir" ortografia por conta
// própria, cortar o crédito de um artista convidado ou colar rótulos de
// lançamento no fim do nome.
//
// Por que isso existe: os adapters montavam o nome da versão como
// "Daft Punk (Compilation)" / "One More Time (Live)". Isso é um nome que não
// existe em nenhum estúdio — o tipo de lançamento já tem campo próprio
// (release_type) e é lá que ele deve aparecer. Versões antigas gravadas assim
// continuam no banco (Regra 2) e são apenas registradas para o dono decidir.

// Devolve o nome como a fonte oficial publicou, apenas sem espaços sobrando.
// Não altera caixa, acentos, pontuação nem o conteúdo do nome.
export function limparNomeOficial(valor: string | null | undefined): string {
  if (!valor) return '';
  // \s cobre espaço comum, tabulação e espaço fixo (U+00A0) usado em créditos.
  return valor.replace(/\s+/g, ' ').trim();
}

// Nome obrigatório: devolve null quando o resultado fica vazio, para que a
// ingestão descarte o registro em vez de gravar um nome inexistente.
export function nomeOficialOuNulo(valor: string | null | undefined): string | null {
  const limpo = limparNomeOficial(valor);
  return limpo.length > 0 ? limpo : null;
}
