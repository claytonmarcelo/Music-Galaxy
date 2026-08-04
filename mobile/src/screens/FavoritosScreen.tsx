// Tela de Favoritos — lista todos os releases marcados como favoritos.

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import ReleaseCard from '../components/ReleaseCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Favoritos'>;

export default function FavoritosScreen({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();

  // Navega para detalhes do release
  const handleSelecionarRelease = (releaseId: number): void => {
    const release = favoritos.find(f => f.id === releaseId);
    if (release) {
      navigation.push('DetalheRelease', { release });
    }
  };

  // Remove favorito com confirmação
  const handleRemoverFavorito = (releaseId: number): void => {
    Alert.alert(
      'Remover Favorito',
      'Tem certeza que deseja remover este release dos favoritos?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remover',
          onPress: () => removerFavorito(releaseId),
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.headerBox}>
        <Text style={styles.tituloHeader}>Favoritos</Text>
        <Text style={styles.subtituloHeader}>
          {favoritos.length} release{favoritos.length !== 1 ? 's' : ''}
        </Text>
      </View>

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
            <Text style={styles.textoVazio}>
              Nenhum favorito ainda
            </Text>
            <Text style={styles.descricaoVazia}>
              Adicione releases aos seus favoritos tocando no ♡ para vê-los aqui
            </Text>
            <TouchableOpacity
              style={styles.botaoVoltar}
              onPress={() => navigation.push('Busca')}
            >
              <Text style={styles.textoBotao}>Começar a Buscar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  tituloHeader: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  subtituloHeader: {
    color: '#AAAAAA',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },

  descricaoVazia: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  botaoVoltar: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 6,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
