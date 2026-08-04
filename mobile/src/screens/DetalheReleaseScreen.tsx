// Tela de detalhes de um release específico.
// Exibe todas as informações disponíveis sobre a versão selecionada.
// Respeita a Regra 1: capa oficial só quando cover_url não for null.

import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type RouteProps = RouteProp<RootStackParamList, 'DetalheRelease'>;

// Mapeamento de labels por categoria
const LABELS_CATEGORIA: Record<string, string> = {
  release_format: 'Formato',
  mix_edit:       'Mixagem / Edição',
  instrumental:   'Instrumental',
  playback:       'Playback',
};

const CORES_CATEGORIA: Record<string, string> = {
  release_format: '#1DB954',
  mix_edit:       '#1E90FF',
  instrumental:   '#9B59B6',
  playback:       '#E67E22',
};

export default function DetalheReleaseScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route      = useRoute<RouteProps>();
  const { release } = route.params;

  const corCategoria = CORES_CATEGORIA[release.release_type_category] ?? '#888';
  const labelCategoria = LABELS_CATEGORIA[release.release_type_category] ?? release.release_type_category;

  const abrirFonte = () => {
    if (release.source_reference_url) {
      Linking.openURL(release.source_reference_url);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

      {/* Botão voltar */}
      <TouchableOpacity
        style={styles.botaoVoltar}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Voltar para a busca"
      >
        <Text style={styles.botaoVoltarTexto}>← Voltar</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Capa — Regra 1: só exibe se cover_url não for null */}
        <View style={styles.capaContainer}>
          {release.cover_url ? (
            <Image
              source={{ uri: release.cover_url }}
              style={styles.capa}
              resizeMode="cover"
              accessibilityLabel={`Capa de ${release.version_name}`}
            />
          ) : (
            <View style={[styles.capa, styles.semCapa]}>
              <Text style={styles.semCapaIcone}>♪</Text>
              <Text style={styles.semCapaTexto}>Sem Capa Oficial</Text>
            </View>
          )}
        </View>

        {/* Artista e título */}
        <View style={styles.cabecalho}>
          <Text style={styles.artista}>{release.artist_name}</Text>
          <Text style={styles.titulo}>{release.version_name}</Text>

          {release.album_name && release.album_name !== release.version_name && (
            <Text style={styles.album}>do álbum "{release.album_name}"</Text>
          )}

          {/* Badge do tipo */}
          <View style={[styles.badge, { backgroundColor: corCategoria }]}>
            <Text style={styles.badgeTexto}>{release.release_type}</Text>
          </View>
        </View>

        {/* Seção de informações detalhadas */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Detalhes do Lançamento</Text>

          <InfoLinha label="Categoria"   valor={labelCategoria} />
          <InfoLinha label="Tipo"        valor={release.release_type} />
          <InfoLinha label="Ano"         valor={release.release_year?.toString()} />
          <InfoLinha label="País"        valor={release.country} />
          <InfoLinha label="Gravadora"   valor={release.label} />
          <InfoLinha label="Qualidade"   valor={release.quality} />
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Obra Musical</Text>
          <InfoLinha label="Título"       valor={release.work_title} />
          <InfoLinha label="Artista"      valor={release.artist_name} />
          <InfoLinha label="País do artista" valor={release.artist_country} />
          <InfoLinha label="Lançamento original" valor={release.original_release_year?.toString()} />
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Metadados</Text>
          <InfoLinha label="Fonte"   valor={release.metadata_source} />

          {release.source_reference_url && (
            <TouchableOpacity onPress={abrirFonte} style={styles.linkFonte}>
              <Text style={styles.linkFonteTexto}>Ver na fonte original →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Componente auxiliar para uma linha de informação "label: valor"
function InfoLinha({ label, valor }: { label: string; valor?: string | null }): React.JSX.Element | null {
  if (!valor) return null;
  return (
    <View style={infoStyles.container}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.valor}>{valor}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  label: {
    fontSize: 13,
    color: '#8080A0',
    flex: 1,
  },
  valor: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  botaoVoltar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
  },
  botaoVoltarTexto: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    paddingBottom: 40,
  },
  capaContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  capa: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  semCapa: {
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  semCapaIcone: {
    fontSize: 60,
    color: '#2A2A4A',
    marginBottom: 8,
  },
  semCapaTexto: {
    fontSize: 14,
    color: '#404060',
  },
  cabecalho: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  artista: {
    fontSize: 14,
    color: '#8080A0',
    marginBottom: 4,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  album: {
    fontSize: 13,
    color: '#606080',
    marginBottom: 12,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  badgeTexto: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secao: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#12121F',
    borderRadius: 12,
    padding: 16,
  },
  secaoTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#606080',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  linkFonte: {
    paddingTop: 12,
  },
  linkFonteTexto: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '600',
  },
});
