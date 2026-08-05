// Tela de detalhes de um release específico.
// Exibe todas as informações disponíveis sobre a versão selecionada com design premium.
// Respeita a Regra 1: capa oficial só quando cover_url não for null.
// NÃO abre links externos — tudo permanece dentro do app.

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useModal } from '../contexts/ModalContext';
import PlayerControls from '../components/PlayerControls';
import DownloadProgress from '../components/DownloadProgress';
import ModalPersonalizado from '../components/ModalPersonalizado';
import { TIMINGS, EASING, fadeInOut, scaleSpring } from '../utils/animacoes';

type RouteProps = RouteProp<RootStackParamList, 'DetalheRelease'>;

const { width } = Dimensions.get('window');

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
  const { isFavorito, adicionarFavorito, removerFavorito } = useFavoritos();
  const { abrirInfo, toastSucesso, toastErro } = useModal();
  
  const [mostraModalFonte, setMostraModalFonte] = useState(false);
  const [ehFavorito, setEhFavorito] = useState(isFavorito(release.id));

  // Animações
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const scaleCapaAnim = useRef(new Animated.Value(0.8)).current;
  const slideConteudeAnim = useRef(new Animated.Value(50)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animação de entrada
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(fadeInAnim, {
          toValue: 1,
          duration: TIMINGS.normal,
          useNativeDriver: true,
        }),
        Animated.spring(scaleCapaAnim, {
          toValue: 1,
          useNativeDriver: true,
          ...EASING.suave,
        }),
      ]),
      Animated.timing(slideConteudeAnim, {
        toValue: 0,
        duration: TIMINGS.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeInAnim, scaleCapaAnim, slideConteudeAnim]);

  const corCategoria = CORES_CATEGORIA[release.release_type_category] ?? '#888';
  const labelCategoria = LABELS_CATEGORIA[release.release_type_category] ?? release.release_type_category;

  // Toggles favorito
  const toggleFavorito = async () => {
    try {
      if (ehFavorito) {
        await removerFavorito(release.id);
        setEhFavorito(false);
        toastSucesso('Removido de favoritos');
      } else {
        await adicionarFavorito(release);
        setEhFavorito(true);
        toastSucesso('Adicionado aos favoritos!');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao alterar favorito';
      toastErro(mensagem);
      console.error('Erro ao alterar favorito:', err);
    }
  };

  const abrirModalFonte = () => {
    abrirInfo(
      'Fonte de Dados',
      `Os dados desta música foram obtidos de ${release.metadata_source}.\n\nO Music Galaxy exibe exclusivamente dados oficiais fornecidos pela fonte original.`
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

      {/* Botões no header: voltar + favorito */}
      <Animated.View
        style={[
          styles.headerTop,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Voltar para a busca"
        >
          <Text style={styles.botaoVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        
        {/* Botão de favorito */}
        <TouchableOpacity
          style={styles.botaoFavorito}
          onPress={toggleFavorito}
          activeOpacity={0.7}
          accessibilityLabel={ehFavorito ? 'Remover de favoritos' : 'Adicionar aos favoritos'}
        >
          <Text style={styles.botaoFavoritoTexto}>{ehFavorito ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Capa — Regra 1: só exibe se cover_url não for null */}
        <Animated.View
          style={[
            styles.capaContainer,
            {
              opacity: fadeInAnim,
              transform: [{ scale: scaleCapaAnim }],
            },
          ]}
        >
          {release.cover_url ? (
            <View style={styles.capaWrapper}>
              <Image
                source={{ uri: release.cover_url }}
                style={styles.capa}
                resizeMode="cover"
                accessibilityLabel={`Capa de ${release.version_name}`}
              />
              {/* Shadow effect */}
              <View style={styles.capaShadow} />
            </View>
          ) : (
            <View style={[styles.capa, styles.semCapa]}>
              <Text style={styles.semCapaIcone}>♪</Text>
              <Text style={styles.semCapaTexto}>Sem Capa Oficial</Text>
            </View>
          )}
        </Animated.View>

        {/* Artista e título com animação */}
        <Animated.View
          style={[
            styles.cabecalho,
            {
              opacity: fadeInAnim,
              transform: [{ translateY: slideConteudeAnim }],
            },
          ]}
        >
          <Text style={styles.artista}>{release.artist_name}</Text>
          <Text style={styles.titulo}>{release.version_name}</Text>

          {release.album_name && release.album_name !== release.version_name && (
            <Text style={styles.album}>do álbum "{release.album_name}"</Text>
          )}

          {/* Badge do tipo com cor dinâmica */}
          <View style={[styles.badge, { backgroundColor: corCategoria }]}>
            <Text style={styles.badgeTexto}>{release.release_type}</Text>
          </View>
        </Animated.View>

        {/* Player de áudio — permite reprodução de preview SEMPRE VISÍVEL */}
        <Animated.View
          style={{
            opacity: fadeInAnim,
            transform: [{ translateY: slideConteudeAnim }],
          }}
        >
          <PlayerControls
            url={release.audio_preview_url || release.streaming_url || release.download_url || ''}
            titulo={release.version_name}
            artista={release.artist_name}
          />
        </Animated.View>

        {/* Download — permite salvar arquivo localmente — SEMPRE VISÍVEL */}
        <Animated.View
          style={{
            opacity: fadeInAnim,
            transform: [{ translateY: slideConteudeAnim }],
          }}
        >
          <DownloadProgress
            url={release.download_url || ''}
            titulo={release.version_name}
            artista={release.artist_name}
          />
        </Animated.View>
        <Animated.View
          style={{
            opacity: fadeInAnim,
            transform: [{ translateY: slideConteudeAnim }],
          }}
        >
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Detalhes do Lançamento</Text>

            <InfoLinha label="Categoria"   valor={labelCategoria} cor={corCategoria} />
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
            <InfoLinha label="Fonte"   valor={release.metadata_source} cor="#1DB954" />

            {release.source_reference_url && (
              <TouchableOpacity 
                onPress={abrirModalFonte}
                style={styles.linkFonte}
                activeOpacity={0.7}
              >
                <Text style={styles.linkFonteTexto}>ℹ️ Informações da Fonte →</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// Componente auxiliar para uma linha de informação "label: valor"
function InfoLinha({ 
  label, 
  valor,
  cor,
}: { 
  label: string; 
  valor?: string | null;
  cor?: string;
}): React.JSX.Element | null {
  if (!valor) return null;
  return (
    <View style={infoStyles.container}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.valor, cor ? { color: cor } : undefined]}>{valor}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  label: {
    fontSize: 13,
    color: '#8080A0',
    flex: 1,
    fontWeight: '500',
  },
  valor: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 2,
    textAlign: 'right',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  botaoVoltar: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  botaoVoltarTexto: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '600',
  },
  botaoFavorito: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  botaoFavoritoTexto: {
    fontSize: 24,
  },
  scroll: {
    paddingBottom: 40,
  },
  capaContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  capaWrapper: {
    position: 'relative',
  },
  capa: {
    width: 240,
    height: 240,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  capaShadow: {
    position: 'absolute',
    bottom: -8,
    left: 12,
    right: 12,
    height: 12,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderRadius: 50,
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
    fontWeight: '500',
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  album: {
    fontSize: 13,
    color: '#606080',
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  badgeTexto: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  secao: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#12121F',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#1DB954',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  secaoTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1DB954',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  linkFonte: {
    paddingTop: 12,
    marginTop: 4,
  },
  linkFonteTexto: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '600',
  },
});
