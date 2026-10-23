// Componente CardObra — exibe uma obra musical com artista e ano de
// lançamento original. Visual de vidro fosco: fundo translúcido, contorno
// sutil e ícone de linha, com as cores sempre resolvidas pelos tokens do
// tema ativo. É o mesmo cartão usado em Explorar e nos detalhes do artista.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Work } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { comAlfa } from '../utils/cores';
import Icone from './Icone';

interface Props {
  obra: Work;
  onPress: (obra: Work) => void;
  // Em telas de artista o nome do artista já está no cabeçalho.
  mostraArtista?: boolean;
}

export default function CardObra({
  obra,
  onPress,
  mostraArtista = true,
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  const ano = obra.effective_year ?? obra.original_release_year;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
      ]}
      onPress={() => onPress(obra)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Abrir a obra ${obra.title}`}
    >
      <View
        style={[styles.icone, { backgroundColor: comAlfa(colors.primary, 0.12) }]}
      >
        <Icone nome="musica" tamanho={16} cor={colors.primary} />
      </View>

      <View style={styles.conteudo}>
        <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={2}>
          {obra.title}
        </Text>

        {mostraArtista && (
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {obra.artist.name}
          </Text>
        )}

        {ano && (
          <Text style={[styles.ano, { color: colors.primary }]} numberOfLines={1}>
            {ano}
          </Text>
        )}
      </View>

      <Icone nome="seta" tamanho={17} cor={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  icone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: {
    flex: 1,
  },
  titulo: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  artista: {
    fontSize: 10.5,
    marginTop: 2,
  },
  ano: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
});
