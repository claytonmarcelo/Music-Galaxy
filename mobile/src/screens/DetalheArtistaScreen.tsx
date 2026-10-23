// Tela de detalhes de um artista.
// Mostra a identidade do artista e todas as obras com versões disponíveis,
// em cartões de vidro fosco sobre o fundo atmosférico do aplicativo.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Artista, Work } from '../types';
import { buscarArtista, buscarObrasArtista } from '../services/api';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheArtista'>;

export default function DetalheArtistaScreen({ route, navigation }: Props): React.JSX.Element {
  const { artistaId } = route.params;
  const { abrirErro } = useModal();
  const { colors } = useTheme();

  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [artista, setArtista] = useState<Artista | null>(null);
  const [obras, setObras] = useState<Work[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);

  const LIMIT = 50;

  const carregarArtista = useCallback(async (): Promise<void> => {
    try {
      const resposta = await buscarArtista(artistaId);

      if (!resposta.success) {
        throw new Error('Erro ao carregar artista');
      }

      setArtista(resposta.data);
      setErro(null);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErro(mensagem);
      abrirErro(
        'Não foi possível carregar',
        'Não foi possível carregar as informações deste artista. Verifique sua conexão e tente novamente.\n\nDetalhe: ' + mensagem
      );
    }
  }, [artistaId, abrirErro]);

  const carregarObras = useCallback(
    async (offset = 0, adicionar = false): Promise<void> => {
      try {
        if (offset === 0) setCarregando(true);
        const resposta = await buscarObrasArtista(artistaId, { limit: LIMIT, offset });

        if (!resposta.success) {
          throw new Error('Erro ao carregar obras');
        }

        const { results, total } = resposta.data;

        if (adicionar) {
          setObras((prev) => [...prev, ...results]);
        } else {
          setObras(results);
        }

        setTemMais(offset + LIMIT < total);
        setPagina(Math.floor(offset / LIMIT) + 1);
        setErro(null);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
        setErro(mensagem);
        abrirErro(
          'Não foi possível carregar',
          'Não foi possível carregar as obras deste artista. Verifique sua conexão e tente novamente.\n\nDetalhe: ' + mensagem
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [artistaId, abrirErro]
  );

  useEffect(() => {
    void carregarArtista();
    void carregarObras(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistaId]);

  const carregarMais = useCallback((): void => {
    if (!temMais || atualizando || carregando) return;
    setAtualizando(true);
    void carregarObras(pagina * LIMIT, true);
  }, [pagina, temMais, atualizando, carregando, carregarObras]);

  const handleAtualizacao = useCallback(async (): Promise<void> => {
    setAtualizando(true);
    await carregarArtista();
    await carregarObras(0, false);
  }, [carregarArtista, carregarObras]);

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
        <Text style={[styles.headerTitulo, { color: colors.text }]}>Artista</Text>
        <Text style={[styles.headerSubtitulo, { color: colors.textSecondary }]} numberOfLines={1}>
          {artista?.name ?? 'Carregando...'}
        </Text>
      </View>

      <View
        style={[
          styles.headerSelo,
          { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        ]}
      >
        <Icone nome="fone" tamanho={16} cor={colors.primary} />
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
              Carregando artista...
            </Text>
          </View>
        </SafeAreaView>
      </FundoAtmosfera>
    );
  }

  if (erro && !artista) {
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
                onPress={() => {
                  void carregarArtista();
                  void carregarObras(0, false);
                }}
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
          {/* Cabeçalho do artista */}
          <GlassCard style={styles.secaoCabecalho}>
            <View style={styles.artistaLinha}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: comAlfa(colors.primary, 0.16), borderColor: comAlfa(colors.primary, 0.3) },
                ]}
              >
                <Icone nome="fone" tamanho={26} cor={colors.primary} />
              </View>

              <View style={styles.artistaTextos}>
                <Text style={[styles.nomeArtista, { color: colors.text }]} numberOfLines={2}>
                  {artista?.name || 'Artista'}
                </Text>
                {artista?.country && (
                  <View style={styles.paisLinha}>
                    <Icone nome="pais" tamanho={12} cor={colors.textSecondary} />
                    <Text style={[styles.paisArtista, { color: colors.textSecondary }]}>
                      {artista.country}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />

            <View style={styles.artistaRodape}>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
              >
                <Icone nome="musica" tamanho={12} cor={colors.primary} />
                <Text style={[styles.chipTexto, { color: colors.text }]}>
                  {obras.length} {obras.length === 1 ? 'obra' : 'obras'}
                </Text>
              </View>
              <Text style={[styles.artistaDica, { color: colors.textSecondary }]}>
                Somente obras com versões disponíveis
              </Text>
            </View>
          </GlassCard>

          {/* Obras do artista */}
          {obras.length > 0 ? (
            <View>
              <View style={styles.listaCabecalho}>
                <Text style={[styles.listaTitulo, { color: colors.text }]}>Obras musicais</Text>
              </View>

              {obras.map((obra) => (
                <TouchableOpacity
                  key={obra.id}
                  style={[
                    styles.cardObra,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                  onPress={() => navigation.push('DetalheWork', { workId: obra.id })}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir a obra ${obra.title}`}
                >
                  <View
                    style={[
                      styles.cardIcone,
                      { backgroundColor: comAlfa(colors.primary, 0.12) },
                    ]}
                  >
                    <Icone nome="musica" tamanho={17} cor={colors.primary} />
                  </View>

                  <View style={styles.conteudoCard}>
                    <Text style={[styles.tituloObra, { color: colors.text }]} numberOfLines={2}>
                      {obra.title}
                    </Text>
                    <Text style={[styles.anoObra, { color: colors.textSecondary }]}>
                      {obra.original_release_year
                        ? `Lançamento original em ${obra.original_release_year}`
                        : 'Ano de lançamento desconhecido'}
                    </Text>
                  </View>

                  <Icone nome="seta" tamanho={17} cor={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.containerSemDados}>
              <Icone nome="musica" tamanho={30} cor={colors.textSecondary} />
              <Text style={[styles.textoSemDados, { color: colors.textSecondary }]}>
                Nenhuma obra com versões disponíveis no momento
              </Text>
            </View>
          )}

          {temMais && (
            <View style={styles.containerCarregarMais}>
              <CustomButton
                title="Carregar mais obras"
                variant="secondary"
                icone="setaBaixo"
                loading={atualizando}
                onPress={carregarMais}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
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
  artistaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistaTextos: {
    flex: 1,
  },
  nomeArtista: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  paisLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  paisArtista: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  divisor: {
    height: 1,
    marginVertical: 14,
  },
  artistaRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
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
  artistaDica: {
    fontSize: 10.5,
    flexShrink: 1,
  },
  listaCabecalho: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  listaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardObra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardIcone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudoCard: {
    flex: 1,
  },
  tituloObra: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  anoObra: {
    fontSize: 10.5,
    marginTop: 3,
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
