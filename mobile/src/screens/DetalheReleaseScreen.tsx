// Tela de detalhes de uma versão.
// Exibe a capa oficial (Regra 1), o player de stream e o painel de download
// sobre o fundo atmosférico do aplicativo. O áudio SEMPRE passa pelos
// endpoints do backend, que resolvem a fonte em sites abertos da web
// (Regra 3) — nenhum link de plataforma é aberto ou exibido.

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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import PlayerControls from '../components/PlayerControls';
import DownloadProgress from '../components/DownloadProgress';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import { BASE_URL } from '../services/api';
import { TIMINGS, EASING, USE_NATIVE_DRIVER } from '../utils/animacoes';
import { traduzirTipoRelease } from '../utils/tiposRelease';
import { comAlfa } from '../utils/cores';

type RouteProps = RouteProp<RootStackParamList, 'DetalheRelease'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'DetalheRelease'>;

// Rótulos por categoria de versão.
const LABELS_CATEGORIA: Record<string, string> = {
  release_format: 'Formato de lançamento',
  mix_edit:       'Mixagem / edição',
  instrumental:   'Instrumental',
  playback:       'Playback',
};

export default function DetalheReleaseScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProps>();
  const { release } = route.params;
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  // Regra 3: playback e download passam SEMPRE pelos endpoints do backend,
  // que resolvem a fonte em sites abertos (nunca YouTube/Spotify/Deezer).
  const urlStream = `${BASE_URL}/api/releases/${release.id}/stream`;

  const { isFavorito, adicionarFavorito, removerFavorito } = useFavoritos();
  const { abrirInfo, toastSucesso, toastErro } = useModal();

  const [ehFavorito, setEhFavorito] = useState(isFavorito(release.id));

  // Animações de entrada: capa, cabeçalho e blocos de conteúdo.
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const scaleCapaAnim = useRef(new Animated.Value(0.92)).current;
  const slideConteudoAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.stagger(90, [
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
      Animated.timing(slideConteudoAnim, {
        toValue: 0,
        duration: TIMINGS.normal,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeInAnim, scaleCapaAnim, slideConteudoAnim]);

  // Cores de destaque por categoria, derivadas do tema (sem cores fixas).
  const coresCategoria: Record<string, string> = {
    release_format: colors.success,
    mix_edit:       colors.luzSecundaria,
    instrumental:   colors.luzPrimaria,
    playback:       colors.warning,
  };
  const corCategoria = coresCategoria[release.release_type_category] ?? colors.textSecondary;
  const labelCategoria = LABELS_CATEGORIA[release.release_type_category] ?? release.release_type;
  const tamanhoCapa = Math.min(width - 104, 280);

  const toggleFavorito = async () => {
    try {
      if (ehFavorito) {
        await removerFavorito(release.id);
        setEhFavorito(false);
        toastSucesso('Removido dos favoritos');
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
      'Fonte de dados',
      `Os dados desta música foram obtidos de ${release.metadata_source}.\n\nO Music Galaxy exibe exclusivamente dados oficiais fornecidos pela fonte original.`
    );
  };

  return (
    <FundoAtmosfera>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Barra superior: voltar, título da tela e favorito */}
        <Animated.View style={[styles.header, { opacity: fadeInAnim }]}>
          <TouchableOpacity
            style={[
              styles.botaoCirculo,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            accessibilityLabel="Voltar"
          >
            <Icone nome="voltar" tamanho={19} cor={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTextos}>
            <Text style={[styles.headerTitulo, { color: colors.text }]}>Detalhes da versão</Text>
            <Text style={[styles.headerSubtitulo, { color: colors.textSecondary }]}>
              {release.artist_name}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.botaoCirculo,
              ehFavorito && {
                backgroundColor: comAlfa(colors.primary, 0.16),
                borderColor: comAlfa(colors.primary, 0.4),
              },
              !ehFavorito && { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
            onPress={toggleFavorito}
            activeOpacity={0.75}
            accessibilityLabel={ehFavorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Icone
              nome={ehFavorito ? 'favoritoCheio' : 'favorito'}
              tamanho={18}
              cor={ehFavorito ? colors.primary : colors.text}
            />
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Capa oficial — Regra 1: só exibe quando cover_url existe */}
          <Animated.View
            style={[
              styles.capaContainer,
              { opacity: fadeInAnim, transform: [{ scale: scaleCapaAnim }] },
            ]}
          >
            {release.cover_url ? (
              <View
                style={[
                  styles.capaWrapper,
                  {
                    shadowColor: colors.glassShadow,
                    ...Platform.select({
                      android: { elevation: 14 },
                    }),
                  },
                ]}
              >
                <Image
                  source={{ uri: release.cover_url }}
                  style={[
                    styles.capa,
                    { width: tamanhoCapa, height: tamanhoCapa },
                  ]}
                  resizeMode="cover"
                  accessibilityLabel={`Capa de ${release.version_name}`}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.capa,
                  styles.semCapa,
                  {
                    width: tamanhoCapa,
                    height: tamanhoCapa,
                    backgroundColor: colors.glassCard,
                    borderColor: colors.glassBorder,
                  },
                ]}
              >
                <Icone nome="album" tamanho={44} cor={colors.textSecondary} />
                <Text style={[styles.semCapaTexto, { color: colors.textSecondary }]}>
                  Sem capa oficial
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Identidade da versão */}
          <Animated.View
            style={[
              styles.cabecalho,
              { opacity: fadeInAnim, transform: [{ translateY: slideConteudoAnim }] },
            ]}
          >
            <Text style={[styles.artista, { color: colors.textSecondary }]}>
              {release.artist_name}
            </Text>
            <Text style={[styles.titulo, { color: colors.text }]}>{release.version_name}</Text>

            {release.album_name && release.album_name !== release.version_name && (
              <Text style={[styles.album, { color: colors.textSecondary }]}>
                do álbum “{release.album_name}”
              </Text>
            )}

            <View style={styles.chips}>
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor: comAlfa(corCategoria, 0.14),
                    borderColor: comAlfa(corCategoria, 0.34),
                  },
                ]}
              >
                <Icone nome="album" tamanho={12} cor={corCategoria} />
                <Text style={[styles.chipTexto, { color: corCategoria }]}>
                  {traduzirTipoRelease(release.release_type)}
                </Text>
              </View>

              {release.release_year && (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                >
                  <Icone nome="calendario" tamanho={12} cor={colors.textSecondary} />
                  <Text style={[styles.chipTexto, { color: colors.textSecondary }]}>
                    {release.release_year}
                  </Text>
                </View>
              )}

              {release.quality && (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                >
                  <Icone nome="qualidade" tamanho={12} cor={colors.textSecondary} />
                  <Text style={[styles.chipTexto, { color: colors.textSecondary }]}>
                    {release.quality}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Player — stream completo via backend (Regra 3) */}
          <Animated.View
            style={{ opacity: fadeInAnim, transform: [{ translateY: slideConteudoAnim }] }}
          >
            <PlayerControls
              url={urlStream}
              titulo={release.version_name}
              artista={release.artist_name}
            />
          </Animated.View>

          {/* Download com escolha de qualidade */}
          <Animated.View
            style={{ opacity: fadeInAnim, transform: [{ translateY: slideConteudoAnim }] }}
          >
            <DownloadProgress release={release} />
          </Animated.View>

          {/* Ficha técnica */}
          <Animated.View
            style={{ opacity: fadeInAnim, transform: [{ translateY: slideConteudoAnim }] }}
          >
            <GlassCard style={styles.secao}>
              <SecaoTitulo icone="album" titulo="Detalhes do lançamento" />

              <InfoLinha label="Categoria" valor={labelCategoria} cor={corCategoria} />
              <InfoLinha label="Tipo" valor={release.release_type} />
              <InfoLinha label="Ano" valor={release.release_year?.toString()} />
              <InfoLinha label="País" valor={release.country} />
              <InfoLinha label="Gravadora" valor={release.label} />
              <InfoLinha label="Qualidade" valor={release.quality} />
            </GlassCard>

            <GlassCard style={styles.secao}>
              <SecaoTitulo icone="musica" titulo="Obra musical" />
              <InfoLinha label="Título" valor={release.work_title} />
              <InfoLinha label="Artista" valor={release.artist_name} />
              <InfoLinha label="País do artista" valor={release.artist_country} />
              <InfoLinha label="Lançamento original" valor={release.original_release_year?.toString()} />
            </GlassCard>

            <GlassCard style={styles.secao}>
              <SecaoTitulo icone="escudo" titulo="Áudio e metadados" />

              <InfoLinha
                label="Origem do áudio"
                valor="Fonte aberta da web"
                cor={colors.success}
              />
              {release.audio_source_provider && (
                <InfoLinha label="Provedor" valor={release.audio_source_provider} />
              )}
              <InfoLinha label="Fonte dos dados" valor={release.metadata_source} cor={colors.primary} />

              {release.source_reference_url && (
                <TouchableOpacity
                  onPress={abrirModalFonte}
                  style={[
                    styles.linkFonte,
                    { borderTopColor: colors.glassBorder },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Ver informações da fonte dos dados"
                >
                  <Icone nome="info" tamanho={14} cor={colors.primary} />
                  <Text style={[styles.linkFonteTexto, { color: colors.primary }]}>
                    Informações da fonte
                  </Text>
                  <Icone nome="seta" tamanho={14} cor={colors.primary} />
                </TouchableOpacity>
              )}
            </GlassCard>

            <Text style={[styles.rodapeNota, { color: colors.textSecondary }]}>
              O Music Galaxy reproduz apenas áudio de sites abertos da internet.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

// Título de seção com ícone de linha.
function SecaoTitulo({ icone, titulo }: { icone: NomeIcone; titulo: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.secaoTituloLinha}>
      <Icone nome={icone} tamanho={14} cor={colors.primary} />
      <Text style={[styles.secaoTitulo, { color: colors.text }]}>{titulo}</Text>
    </View>
  );
}

// Linha "rótulo: valor" de uma ficha técnica.
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
    <View style={[infoStyles.container, { borderBottomColor: colors.glassBorder }]}>
      <Text style={[infoStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.valor, { color: cor ?? colors.text }]}>{valor}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 12.5,
    flex: 1,
    fontWeight: '500',
  },
  valor: {
    fontSize: 12.5,
    flex: 1.4,
    textAlign: 'right',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 18 : 4,
    paddingBottom: 10,
  },
  headerTextos: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  headerSubtitulo: {
    fontSize: 10.5,
    marginTop: 2,
  },
  botaoCirculo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  capaContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  capaWrapper: {
    borderRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
  },
  capa: {
    borderRadius: 28,
  },
  semCapa: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
  },
  semCapaTexto: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  cabecalho: {
    paddingHorizontal: 26,
    alignItems: 'center',
    marginBottom: 20,
  },
  artista: {
    fontSize: 11,
    marginBottom: 5,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  titulo: {
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  album: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 13,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTexto: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  secao: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 24,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  linkFonte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 13,
    marginTop: 2,
    borderTopWidth: 1,
  },
  linkFonteTexto: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  rodapeNota: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 40,
    marginTop: 6,
  },
});
