// Tela de detalhes de uma obra musical (Work).
// Exibe a obra conceitual com TODAS as versões agrupadas por categoria
// (Regra 2: nunca ocultar ou substituir versões). Cada versão continua
// sendo um ReleaseCard independente sobre o fundo atmosférico.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release, RespostaReleasesDeWork } from '../types';
import { buscarReleasesDeWork } from '../services/api';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import ReleaseCard from '../components/ReleaseCard';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { TIMINGS, USE_NATIVE_DRIVER } from '../utils/animacoes';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheWork'>;

interface GrupoReleases {
  categoria: string;
  releases: Release[];
}

// Agrupa as versões por categoria, preservando todas as linhas (Regra 2).
function agruparPorCategoria(rels: Release[]): GrupoReleases[] {
  const mapa = new Map<string, Release[]>();

  rels.forEach((rel) => {
    const cat = rel.release_type_category || 'Outros';
    if (!mapa.has(cat)) {
      mapa.set(cat, []);
    }
    mapa.get(cat)!.push(rel);
  });

  return Array.from(mapa.entries()).map(([categoria, relsDaCategoria]) => ({
    categoria,
    releases: relsDaCategoria,
  }));
}

export default function DetalheWorkScreen({ route, navigation }: Props): React.JSX.Element {
  const { workId } = route.params;
  const { toastErro } = useModal();
  const { colors } = useTheme();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [workInfo, setWorkInfo] = useState<RespostaReleasesDeWork['data']['work'] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);

  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const LIMIT = 50;

  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeInAnim]);

  // Os grupos são derivados da lista carregada — nunca um estado paralelo.
  const gruposReleases = useMemo(() => agruparPorCategoria(releases), [releases]);

  const carregarReleases = useCallback(
    async (offset = 0, adicionar = false): Promise<void> => {
      try {
        if (offset === 0) setCarregando(true);
        const resposta = await buscarReleasesDeWork(workId, { limit: LIMIT, offset });

        if (!resposta.success) {
          throw new Error('Erro ao carregar versões');
        }

        const { results, total, work } = resposta.data;

        setWorkInfo(work);
        setReleases((prev) => (adicionar ? [...prev, ...results] : results));
        setTemMais(offset + LIMIT < total);
        setPagina(Math.floor(offset / LIMIT) + 1);
        setErro(null);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
        setErro(mensagem);
        toastErro(mensagem);
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [workId, toastErro]
  );

  useEffect(() => {
    void carregarReleases(0, false);
  }, [carregarReleases]);

  const carregarMais = useCallback((): void => {
    if (!temMais || atualizando || carregando) return;
    setAtualizando(true);
    void carregarReleases(pagina * LIMIT, true);
  }, [pagina, temMais, atualizando, carregando, carregarReleases]);

  const handleAtualizacao = useCallback(async (): Promise<void> => {
    setAtualizando(true);
    await carregarReleases(0, false);
  }, [carregarReleases]);

  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  const barraSuperior = (
    <View style={styles.header}>
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
        <Text style={[styles.headerTitulo, { color: colors.text }]}>Obra completa</Text>
        <Text style={[styles.headerSubtitulo, { color: colors.textSecondary }]} numberOfLines={1}>
          {workInfo ? workInfo.artist.name : 'Carregando...'}
        </Text>
      </View>

      <View
        style={[
          styles.headerSelo,
          { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        ]}
      >
        <Icone nome="musica" tamanho={16} cor={colors.primary} />
      </View>
    </View>
  );

  if (carregando) {
    return (
      <FundoAtmosfera>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          {barraSuperior}
          <View style={styles.containerCentrado}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.textoCentrado, { color: colors.textSecondary }]}>
              Carregando versões da obra...
            </Text>
          </View>
        </SafeAreaView>
      </FundoAtmosfera>
    );
  }

  if (erro && releases.length === 0) {
    return (
      <FundoAtmosfera>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          {barraSuperior}
          <View style={styles.containerCentrado}>
            <View
              style={[
                styles.estadoIcone,
                { backgroundColor: comAlfa(colors.error, 0.12), borderColor: comAlfa(colors.error, 0.3) },
              ]}
            >
              <Icone nome="erro" tamanho={26} cor={colors.error} />
            </View>
            <Text style={[styles.estadoTitulo, { color: colors.text }]}>
              Não foi possível carregar
            </Text>
            <Text style={[styles.textoCentrado, { color: colors.textSecondary }]}>{erro}</Text>
            <View style={styles.estadoAcao}>
              <CustomButton
                title="Tentar novamente"
                icone="recarregar"
                onPress={() => void carregarReleases(0, false)}
              />
            </View>
          </View>
        </SafeAreaView>
      </FundoAtmosfera>
    );
  }

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {barraSuperior}

        <Animated.View style={{ flex: 1, opacity: fadeInAnim }}>
          <ScrollView
            contentContainerStyle={styles.conteudo}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={atualizando}
                onRefresh={handleAtualizacao}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {/* Cabeçalho da obra */}
            <GlassCard style={styles.secaoCabecalho}>
              <View style={styles.obraEtiqueta}>
                <View style={[styles.obraPonto, { backgroundColor: colors.primary }]} />
                <Text style={[styles.obraEtiquetaTexto, { color: colors.textSecondary }]}>
                  OBRA MUSICAL
                </Text>
              </View>
              <Text style={[styles.tituloObra, { color: colors.text }]}>
                {workInfo?.title || 'Obra'}
              </Text>
              <View style={styles.obraRodape}>
                {workInfo && (
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                    ]}
                    onPress={() =>
                      navigation.navigate('DetalheArtista', { artistaId: workInfo.artist.id })
                    }
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver o artista ${workInfo.artist.name}`}
                  >
                    <Icone nome="artista" tamanho={12} cor={colors.primary} />
                    <Text style={[styles.chipTexto, { color: colors.text }]}>
                      {workInfo.artist.name}
                    </Text>
                    <Icone nome="seta" tamanho={11} cor={colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {(workInfo?.effective_year ?? workInfo?.original_release_year) && (
                  <View
                    style={[
                      styles.chip,
                      { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                    ]}
                  >
                    <Icone nome="calendario" tamanho={12} cor={colors.textSecondary} />
                    <Text style={[styles.chipTexto, { color: colors.textSecondary }]}>
                      {workInfo?.effective_year ?? workInfo?.original_release_year}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.chip,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                >
                  <Icone nome="album" tamanho={12} cor={colors.primary} />
                  <Text style={[styles.chipTexto, { color: colors.text }]}>
                    {releases.length} {releases.length === 1 ? 'versão' : 'versões'}
                  </Text>
                </View>
                <Text style={[styles.obraDica, { color: colors.textSecondary }]}>
                  Todas as versões com áudio disponíveis
                </Text>
              </View>
            </GlassCard>

            {/* Grupos por categoria — nenhuma versão é ocultada */}
            {gruposReleases.length > 0 ? (
              gruposReleases.map((grupo) => (
                <View key={grupo.categoria} style={styles.grupo}>
                  <View style={styles.grupoCabecalho}>
                    <Text style={[styles.tituloGrupo, { color: colors.text }]}>
                      {traduzirCategoria(grupo.categoria)}
                    </Text>
                    <View
                      style={[
                        styles.grupoContador,
                        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                      ]}
                    >
                      <Text style={[styles.grupoContadorTexto, { color: colors.textSecondary }]}>
                        {grupo.releases.length}
                      </Text>
                    </View>
                  </View>

                  {grupo.releases.map((release) => (
                    <ReleaseCard
                      key={release.id}
                      release={release}
                      onPress={handleSelecionarRelease}
                    />
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.containerSemDados}>
                <Icone nome="musica" tamanho={30} cor={colors.textSecondary} />
                <Text style={[styles.textoSemDados, { color: colors.textSecondary }]}>
                  Nenhuma versão com áudio disponível no momento
                </Text>
              </View>
            )}

            {temMais && (
              <View style={styles.containerCarregarMais}>
                <CustomButton
                  title="Carregar mais versões"
                  variant="secondary"
                  icone="setaBaixo"
                  loading={atualizando}
                  onPress={carregarMais}
                />
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

// Traduz a categoria técnica para um título legível em pt-BR.
function traduzirCategoria(categoria: string): string {
  const traducoes: Record<string, string> = {
    release_format: 'Formatos de lançamento',
    mix_edit: 'Edições e remixes',
    instrumental: 'Instrumentais',
    playback: 'Playbacks',
  };
  return traducoes[categoria] || categoria;
}

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
  },
  headerSubtitulo: {
    fontSize: 10.5,
    marginTop: 2,
  },
  headerSelo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCirculo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  secaoCabecalho: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 20,
    borderRadius: 26,
  },
  obraEtiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  obraPonto: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  obraEtiquetaTexto: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  tituloObra: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: 0.1,
  },
  obraRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTexto: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  obraDica: {
    fontSize: 10.5,
    flexShrink: 1,
  },
  grupo: {
    marginBottom: 12,
  },
  grupoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  tituloGrupo: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  grupoContador: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grupoContadorTexto: {
    fontSize: 10,
    fontWeight: '700',
  },
  containerCentrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingBottom: 110,
  },
  textoCentrado: {
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
  },
  estadoIcone: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  estadoTitulo: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  estadoAcao: {
    marginTop: 18,
  },
  containerSemDados: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  textoSemDados: {
    fontSize: 13,
    textAlign: 'center',
  },
  containerCarregarMais: {
    alignItems: 'center',
    paddingVertical: 18,
  },
});
