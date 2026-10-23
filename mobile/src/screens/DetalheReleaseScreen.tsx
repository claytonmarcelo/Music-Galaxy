// Tela de detalhes de um release específico.
// Exibe todas as informações disponíveis sobre a versão selecionada,
// com cartões de vidro fosco sobre o fundo decorativo do app.
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
import { useTheme } from '../contexts/ThemeContext';
import PlayerControls from '../components/PlayerControls';
import DownloadProgress from '../components/DownloadProgress';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';
import { BASE_URL } from '../services/api';
import { TIMINGS, EASING, USE_NATIVE_DRIVER } from '../utils/animacoes';
import { traduzirTipoRelease } from '../utils/tiposRelease';

type RouteProps = RouteProp<RootStackParamList, 'DetalheRelease'>;

const { width } = Dimensions.get('window');

// Mapeamento de labels por categoria
const LABELS_CATEGORIA: Record<string, string> = {
  release_format: 'Formato',
  mix_edit:       'Mixagem / Edição',
  instrumental:   'Instrumental',
  playback:       'Playback',
};

export default function DetalheReleaseScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route      = useRoute<RouteProps>();
  const { release } = route.params;
  const { colors, isDark } = useTheme();

  // Regra 3: playback/download passam SEMPRE pelos endpoints do backend,
  // que resolvem a fonte em sites abertos (nunca YouTube/Spotify/Deezer).
  const urlStream   = `${BASE_URL}/api/releases/${release.id}/stream`;
  const urlDownload = `${BASE_URL}/api/releases/${release.id}/download?format=mp3`;
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
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(scaleCapaAnim, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
          ...EASING.suave,
        }),
      ]),
      Animated.timing(slideConteudeAnim, {
        toValue: 0,
        duration: TIMINGS.normal,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeInAnim, scaleCapaAnim, slideConteudeAnim]);

  // Cores de destaque por categoria, derivadas do tema (sem cores fixas)
  const coresCategoria: Record<string, string> = {
    release_format: colors.success,
    mix_edit:       colors.auroraSecundaria,
    instrumental:   colors.auroraPrimaria,
    playback:       colors.warning,
  };
  const corCategoria = coresCategoria[release.release_type_category] ?? colors.textSecondary;
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
    <AuroraBackground>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Barra superior de vidro: voltar + favorito */}
      <Animated.View
        style={{
          opacity: fadeInAnim,
        }}
      >
        <GlassCard forte style={styles.headerTop}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityLabel="Voltar para a busca"
          >
            <Text style={[styles.botaoVoltarTexto, { color: colors.primary }]}>← Voltar</Text>
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
        </GlassCard>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: USE_NATIVE_DRIVER }
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
            <View
              style={[
                styles.capaWrapper,
                Platform.select({
                  ios: {
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                  },
                  android: { elevation: 12 },
                }),
              ]}
            >
              <Image
                source={{ uri: release.cover_url }}
                style={styles.capa}
                resizeMode="cover"
                accessibilityLabel={`Capa de ${release.version_name}`}
              />
              {/* Sombra suave abaixo da capa */}
              <View style={[styles.capaShadow, { backgroundColor: colors.accent }]} />
            </View>
          ) : (
            <View style={[styles.capa, styles.semCapa, { backgroundColor: colors.card }]}>
              <Text style={[styles.semCapaIcone, { color: colors.border }]}>♪</Text>
              <Text style={[styles.semCapaTexto, { color: colors.textSecondary }]}>Sem Capa Oficial</Text>
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
          <Text style={[styles.artista, { color: colors.textSecondary }]}>{release.artist_name}</Text>
          <Text style={[styles.titulo, { color: colors.text }]}>{release.version_name}</Text>

          {release.album_name && release.album_name !== release.version_name && (
            <Text style={[styles.album, { color: colors.textSecondary }]}>do álbum "{release.album_name}"</Text>
          )}

          {/* Badge do tipo com cor dinâmica do tema */}
          <View style={[styles.badge, { backgroundColor: corCategoria }]}>
            <Text style={[styles.badgeTexto, { color: colors.buttonText }]}>{traduzirTipoRelease(release.release_type)}</Text>
          </View>
        </Animated.View>

        {/* Player de áudio — stream completo via backend (Regra 3), SEMPRE VISÍVEL */}
        <Animated.View
          style={{
            opacity: fadeInAnim,
            transform: [{ translateY: slideConteudeAnim }],
          }}
        >
          <PlayerControls
            url={urlStream}
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
            url={urlDownload}
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
          <GlassCard style={styles.secao}>
            <Text style={[styles.secaoTitulo, { color: colors.primary }]}>Detalhes do Lançamento</Text>

            <InfoLinha label="Categoria"   valor={labelCategoria} cor={corCategoria} />
            <InfoLinha label="Tipo"        valor={release.release_type} />
            <InfoLinha label="Ano"         valor={release.release_year?.toString()} />
            <InfoLinha label="País"        valor={release.country} />
            <InfoLinha label="Gravadora"   valor={release.label} />
            <InfoLinha label="Qualidade"   valor={release.quality} />
          </GlassCard>

          <GlassCard style={styles.secao}>
            <Text style={[styles.secaoTitulo, { color: colors.primary }]}>Obra Musical</Text>
            <InfoLinha label="Título"       valor={release.work_title} />
            <InfoLinha label="Artista"      valor={release.artist_name} />
            <InfoLinha label="País do artista" valor={release.artist_country} />
            <InfoLinha label="Lançamento original" valor={release.original_release_year?.toString()} />
          </GlassCard>

          <GlassCard style={styles.secao}>
            <Text style={[styles.secaoTitulo, { color: colors.primary }]}>Metadados</Text>
            <InfoLinha label="Fonte"   valor={release.metadata_source} cor={colors.primary} />

            {release.source_reference_url && (
              <TouchableOpacity
                onPress={abrirModalFonte}
                style={styles.linkFonte}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkFonteTexto, { color: colors.primary }]}>ℹ️ Informações da Fonte →</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        </Animated.View>
      </Animated.ScrollView>
    </AuroraBackground>
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
  const { colors } = useTheme();
  if (!valor) return null;
  return (
    <View style={[infoStyles.container, { borderBottomColor: colors.border }]}>
      <Text style={[infoStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.valor, { color: cor ?? colors.text }]}>{valor}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  valor: {
    fontSize: 13,
    flex: 2,
    textAlign: 'right',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 8,
    borderRadius: 20,
  },
  botaoVoltar: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  botaoVoltarTexto: {
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
  },
  capaShadow: {
    position: 'absolute',
    bottom: -8,
    left: 12,
    right: 12,
    height: 12,
    borderRadius: 50,
  },
  semCapa: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  semCapaIcone: {
    fontSize: 60,
    marginBottom: 8,
  },
  semCapaTexto: {
    fontSize: 14,
  },
  cabecalho: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  artista: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  album: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  secao: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
  },
  secaoTitulo: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  linkFonte: {
    paddingTop: 12,
    marginTop: 4,
  },
  linkFonteTexto: {
    fontSize: 13,
    fontWeight: '600',
  },
});
