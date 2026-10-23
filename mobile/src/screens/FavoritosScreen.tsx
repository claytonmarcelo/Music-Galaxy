// Tela de Favoritos — lista todas as versões marcadas como favoritas,
// com o visual de vidro fosco: cabeçalho e estados sobre o fundo decorativo.

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import ReleaseCard from '../components/ReleaseCard';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Favoritos'>;

export default function FavoritosScreen({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { abrirConfirmacao } = useModal();
  const { colors } = useTheme();

  // Navega para detalhes do release
  const handleSelecionarRelease = (releaseId: number): void => {
    const release = favoritos.find(f => f.id === releaseId);
    if (release) {
      navigation.push('DetalheRelease', { release });
    }
  };

  // Remove favorito com confirmação no modal global
  const handleRemoverFavorito = (releaseId: number): void => {
    abrirConfirmacao(
      'Remover dos favoritos?',
      'Deseja remover esta versão dos seus favoritos?',
      () => removerFavorito(releaseId)
    );
  };

  return (
    <AuroraBackground>
      {/* Barra superior de vidro */}
      <GlassCard forte style={styles.headerBox}>
        <Text style={[styles.tituloHeader, { color: colors.text }]}>Favoritos</Text>
        <Text style={[styles.subtituloHeader, { color: colors.textSecondary }]}>
          {favoritos.length} {favoritos.length === 1 ? 'versão' : 'versões'}
        </Text>
      </GlassCard>

      {/* Conteúdo */}
      {favoritos.length > 0 ? (
        <FlatList
          data={favoritos}
          keyExtractor={rel => `fav-${rel.id}`}
          renderItem={({ item }) => (
            <ReleaseCard
              release={item}
              onPress={() => handleSelecionarRelease(item.id)}
            />
          )}
          contentContainerStyle={styles.listaConteudo}
        />
      ) : (
        <ScrollView style={styles.containerVazio}>
          <View style={styles.viewVazio}>
            <Text style={styles.emoji}>♡</Text>
            <Text style={[styles.textoVazio, { color: colors.text }]}>
              Nenhum favorito ainda
            </Text>
            <Text style={[styles.descricaoVazia, { color: colors.textSecondary }]}>
              Adicione versões aos seus favoritos tocando no ♡ para vê-las aqui
            </Text>
            <TouchableOpacity
              style={[styles.botaoVoltar, { backgroundColor: colors.button }]}
              onPress={() => navigation.push('Busca')}
            >
              <Text style={[styles.textoBotao, { color: colors.buttonText }]}>Começar a buscar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </AuroraBackground>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  headerBox: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },

  tituloHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  subtituloHeader: {
    fontSize: 13,
  },

  listaConteudo: {
    paddingVertical: 8,
  },

  containerVazio: {
    flex: 1,
  },

  viewVazio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },

  textoVazio: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },

  descricaoVazia: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  botaoVoltar: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },

  textoBotao: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
