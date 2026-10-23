// Tela de Exploração — versões recentes e obras por década.
// Uma vitrine de descoberta que respeita a Regra 7: só aparecem versões e
// obras que já têm áudio resolvido em fontes abertas.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList, Release, Work } from '../types';
import { BASE_URL } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import ReleaseCard from '../components/ReleaseCard';
import CardObra from '../components/CardObra';
import Icone from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

type SecaoAtiva = 'recentes' | 'decadas';

interface RespostaReleasesRecentes {
  success: boolean;
  data: {
    results: Release[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface RespostaObrasPorDecada {
  success: boolean;
  data: {
    decade: string;
    results: Work[];
    total: number;
    limit: number;
    offset: number;
  };
}

const DECADAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

// Chave que guarda a preferência de deixar a tela Explorar sem lista.
const CHAVE_EXPLORAR_LIMPO = '@musicgalaxy:explorarLimpo';

const SECOES: Array<{ valor: SecaoAtiva; rotulo: string }> = [
  { valor: 'recentes', rotulo: 'Recentes' },
  { valor: 'decadas', rotulo: 'Por década' },
];

export default function TelaExplorar({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { abrirErro, abrirPersonalizado, toastInfo } = useModal();
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAtiva>('recentes');
  const [carregandoRecentes, setCarregandoRecentes] = useState(true);
  const [releasesRecentes, setReleasesRecentes] = useState<Release[]>([]);
  const [erroRecentes, setErroRecentes] = useState<string | null>(null);

  const [decadaSelecionada, setDecadaSelecionada] = useState(2020);
  const [carregandoDecada, setCarregandoDecada] = useState(false);
  const [obrasDecada, setObrasDecada] = useState<Work[]>([]);
  const [erroDecada, setErroDecada] = useState<string | null>(null);

  // Preferência persistida de manter a tela Explorar sem a lista de versões.
  const [listaLimpa, setListaLimpa] = useState(false);
  // Só busca as listas depois de ler a preferência, para não aparecer conteúdo
  // por um instante antes da tela limpa.
  const [preferenciaCarregada, setPreferenciaCarregada] = useState(false);

  const carregarReleasesRecentes = useCallback(async (): Promise<void> => {
    try {
      setCarregandoRecentes(true);
      setErroRecentes(null);

      const response = await fetch(`${BASE_URL}/api/releases/by-date?limit=50&offset=0`);

      if (!response.ok) {
        throw new Error('Erro ao carregar versões recentes');
      }

      const data: RespostaReleasesRecentes = await response.json();

      if (data.success) {
        setReleasesRecentes(data.data.results);
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErroRecentes(mensagem);
      abrirErro('Não foi possível carregar', mensagem);
    } finally {
      setCarregandoRecentes(false);
    }
  }, [abrirErro]);

  const carregarObrasPorDecada = useCallback(async (decada: number): Promise<void> => {
    try {
      setCarregandoDecada(true);
      setErroDecada(null);

      const response = await fetch(
        `${BASE_URL}/api/works/by-decade/${decada}?limit=50&offset=0`
      );

      if (!response.ok) {
        throw new Error('Erro ao carregar obras');
      }

      const data: RespostaObrasPorDecada = await response.json();

      if (data.success) {
        setObrasDecada(data.data.results);
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErroDecada(mensagem);
      abrirErro('Não foi possível carregar', mensagem);
    } finally {
      setCarregandoDecada(false);
    }
  }, [abrirErro]);

  useEffect(() => {
    let ativo = true;

    const carregarPreferencia = async (): Promise<void> => {
      try {
        const valor = await AsyncStorage.getItem(CHAVE_EXPLORAR_LIMPO);
        if (!ativo) return;
        setListaLimpa(valor === '1');
      } catch (erro) {
        console.error('Erro ao ler a preferência da tela Explorar:', erro);
      } finally {
        if (ativo) setPreferenciaCarregada(true);
      }
    };

    void carregarPreferencia();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!preferenciaCarregada || listaLimpa) return;
    void carregarReleasesRecentes();
  }, [carregarReleasesRecentes, preferenciaCarregada, listaLimpa]);

  useEffect(() => {
    if (!preferenciaCarregada || listaLimpa) return;
    if (secaoAtiva === 'decadas') {
      void carregarObrasPorDecada(decadaSelecionada);
    }
  }, [
    secaoAtiva,
    decadaSelecionada,
    carregarObrasPorDecada,
    preferenciaCarregada,
    listaLimpa,
  ]);

  // Limpa a lista visível de Explorar guardando a preferência no aparelho.
  // Nada é removido do catálogo: a busca continua funcionando normalmente.
  const aplicarLimpeza = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(CHAVE_EXPLORAR_LIMPO, '1');
      setListaLimpa(true);
      setReleasesRecentes([]);
      setObrasDecada([]);
      setErroRecentes(null);
      setErroDecada(null);
      toastInfo('Lista de Explorar limpa. Você pode mostrá-la novamente quando quiser.');
    } catch (erro) {
      console.error('Erro ao salvar a limpeza da tela Explorar:', erro);
      abrirErro('Não foi possível limpar', 'Tente novamente em instantes.');
    }
  };

  // Devolve a lista de Explorar e remove a preferência salva.
  const restaurarLista = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CHAVE_EXPLORAR_LIMPO);
      setListaLimpa(false);
      toastInfo('Lista de Explorar restaurada.');
    } catch (erro) {
      console.error('Erro ao restaurar a lista da tela Explorar:', erro);
      abrirErro('Não foi possível restaurar', 'Tente novamente em instantes.');
    }
  };

  // A limpeza é sempre uma decisão do usuário: o modal explica as consequências.
  const handleSolicitarLimpeza = (): void => {
    abrirPersonalizado(
      'confirmacao',
      'Limpar a lista de Explorar?',
      'As versões recentes e as obras por década saem desta tela para você navegar com calma. Nada é apagado do catálogo: as versões continuam disponíveis na busca e você pode mostrar a lista novamente quando quiser.',
      [
        { texto: 'Manter a lista', onPress: () => {}, estilo: 'secundario' },
        { texto: 'Limpar a lista', onPress: () => void aplicarLimpeza(), estilo: 'destrutivo' },
      ]
    );
  };

  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  const handleSelecionarObra = (obra: Work): void => {
    navigation.push('DetalheWork', { workId: obra.id });
  };

  const renderErro = (mensagem: string, tentarNovamente: () => void): React.JSX.Element => (
    <GlassCard style={styles.estadoCard}>
      <View
        style={[
          styles.estadoIcone,
          { backgroundColor: comAlfa(colors.error, 0.12), borderColor: comAlfa(colors.error, 0.3) },
        ]}
      >
        <Icone nome="erro" tamanho={24} cor={colors.error} />
      </View>
      <Text style={[styles.estadoTitulo, { color: colors.text }]}>
        Não foi possível carregar
      </Text>
      <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>{mensagem}</Text>
      <View style={styles.estadoAcao}>
        <CustomButton title="Tentar novamente" icone="recarregar" size="small" onPress={tentarNovamente} />
      </View>
    </GlassCard>
  );

  // Estado da tela depois que o usuário opta por limpar a lista de Explorar.
  const renderListaLimpa = (): React.JSX.Element => (
    <GlassCard style={styles.estadoCard}>
      <View
        style={[
          styles.estadoIcone,
          { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        ]}
      >
        <Icone nome="lixeira" tamanho={24} cor={colors.textSecondary} />
      </View>
      <Text style={[styles.estadoTitulo, { color: colors.text }]}>Lista limpa</Text>
      <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
        As versões recentes e as obras por década não estão na tela agora. Nada foi apagado do
        catálogo: a busca continua funcionando normalmente.
      </Text>
      <View style={styles.estadoAcao}>
        <CustomButton
          title="Mostrar a lista novamente"
          icone="recarregar"
          size="small"
          onPress={() => void restaurarLista()}
        />
      </View>
    </GlassCard>
  );

  const renderRecentes = (): React.JSX.Element => {
    if (carregandoRecentes) {
      return (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.textoCarregando, { color: colors.textSecondary }]}>
            Carregando versões recentes...
          </Text>
        </View>
      );
    }

    if (erroRecentes) {
      return renderErro(erroRecentes, () => void carregarReleasesRecentes());
    }

    if (releasesRecentes.length === 0) {
      return (
        <GlassCard style={styles.estadoCard}>
          <View
            style={[
              styles.estadoIcone,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
          >
            <Icone nome="musica" tamanho={24} cor={colors.textSecondary} />
          </View>
          <Text style={[styles.estadoTitulo, { color: colors.text }]}>
            Nenhuma versão recente
          </Text>
          <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
            Assim que novas versões com áudio forem encontradas, elas aparecem aqui.
          </Text>
        </GlassCard>
      );
    }

    return (
      <View>
        <View style={styles.secaoCabecalho}>
          <View style={styles.secaoTituloLinha}>
            <Icone nome="ondas" tamanho={14} cor={colors.primary} />
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>Versões recentes</Text>
          </View>
          <Text style={[styles.secaoContagem, { color: colors.textSecondary }]}>
            {releasesRecentes.length}
          </Text>
        </View>

        {releasesRecentes.map((release) => (
          <ReleaseCard
            key={release.id}
            release={release}
            onPress={handleSelecionarRelease}
          />
        ))}
      </View>
    );
  };

  const renderDecadas = (): React.JSX.Element => (
    <View>
      <View style={styles.secaoCabecalho}>
        <View style={styles.secaoTituloLinha}>
          <Icone nome="calendario" tamanho={14} cor={colors.primary} />
          <Text style={[styles.secaoTitulo, { color: colors.text }]}>Explorar por década</Text>
        </View>
      </View>

      <View style={styles.containerDecadas}>
        {DECADAS.map((decada) => {
          const selecionado = decadaSelecionada === decada;
          return (
            <TouchableOpacity
              key={decada}
              style={[
                styles.botaoDecada,
                {
                  backgroundColor: selecionado ? colors.button : colors.glassCard,
                  borderColor: selecionado ? colors.button : colors.glassBorder,
                },
              ]}
              onPress={() => setDecadaSelecionada(decada)}
              activeOpacity={0.75}
              accessibilityState={{ selected: selecionado }}
            >
              <Text
                style={[
                  styles.textoDecada,
                  { color: selecionado ? colors.buttonText : colors.text },
                ]}
              >
                {decada}s
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {carregandoDecada ? (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.textoCarregando, { color: colors.textSecondary }]}>
            Carregando obras dos anos {decadaSelecionada}...
          </Text>
        </View>
      ) : erroDecada ? (
        renderErro(erroDecada, () => void carregarObrasPorDecada(decadaSelecionada))
      ) : obrasDecada.length === 0 ? (
        <GlassCard style={styles.estadoCard}>
          <View
            style={[
              styles.estadoIcone,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
          >
            <Icone nome="calendario" tamanho={24} cor={colors.textSecondary} />
          </View>
          <Text style={[styles.estadoTitulo, { color: colors.text }]}>
            Nenhuma obra nos anos {decadaSelecionada}
          </Text>
          <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
            Só aparecem obras que tenham ao menos uma versão com áudio disponível.
          </Text>
        </GlassCard>
      ) : (
        <>
          <Text style={[styles.contagemDecada, { color: colors.textSecondary }]}>
            {obrasDecada.length} {obrasDecada.length === 1 ? 'obra encontrada' : 'obras encontradas'}
          </Text>

          {obrasDecada.map((obra) => (
            <CardObra key={obra.id} obra={obra} onPress={handleSelecionarObra} />
          ))}
        </>
      )}
    </View>
  );

  // Só faz sentido limpar quando há algo na tela.
  const temConteudo = releasesRecentes.length > 0 || obrasDecada.length > 0;

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoLinha}>
            <View style={styles.cabecalhoTextos}>
              <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>DESCOBERTA</Text>
              <Text style={[styles.titulo, { color: colors.text }]}>Explorar</Text>
            </View>

            {!listaLimpa && temConteudo && (
              <TouchableOpacity
                style={[
                  styles.botaoLimpar,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
                onPress={handleSolicitarLimpeza}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Limpar a lista de Explorar"
              >
                <Icone nome="lixeira" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.botaoLimparTexto, { color: colors.textSecondary }]}>Limpar</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.subtituloHeader, { color: colors.textSecondary }]}>
            Versões recentes e obras por década
          </Text>
        </View>

        {/* Abas em pílulas de vidro — escondidas enquanto a lista está limpa */}
        {!listaLimpa && (
          <View style={styles.containerAbas}>
            {SECOES.map((secao) => {
              const ativa = secaoAtiva === secao.valor;
              return (
                <TouchableOpacity
                  key={secao.valor}
                  style={[
                    styles.aba,
                    {
                      backgroundColor: ativa ? colors.button : colors.glassCard,
                      borderColor: ativa ? colors.button : colors.glassBorder,
                    },
                  ]}
                  onPress={() => setSecaoAtiva(secao.valor)}
                  activeOpacity={0.75}
                  accessibilityState={{ selected: ativa }}
                >
                  <Icone
                    nome={secao.valor === 'recentes' ? 'ondas' : 'calendario'}
                    tamanho={14}
                    cor={ativa ? colors.buttonText : colors.textSecondary}
                  />
                  <Text style={[styles.textoAba, { color: ativa ? colors.buttonText : colors.text }]}>
                    {secao.rotulo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
        >
          {listaLimpa
            ? renderListaLimpa()
            : secaoAtiva === 'recentes'
              ? renderRecentes()
              : renderDecadas()}
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 22 : 8,
    paddingBottom: 10,
  },
  cabecalhoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cabecalhoTextos: {
    flex: 1,
  },
  botaoLimpar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  botaoLimparTexto: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  etiqueta: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtituloHeader: {
    fontSize: 11.5,
    marginTop: 3,
  },
  containerAbas: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoAba: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  conteudo: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secaoContagem: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  containerDecadas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  botaoDecada: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoDecada: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  contagemDecada: {
    fontSize: 10.5,
    paddingHorizontal: 22,
    marginBottom: 9,
  },
  containerCarregando: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  textoCarregando: {
    fontSize: 11.5,
  },
  estadoCard: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 24,
    alignItems: 'center',
  },
  estadoIcone: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  estadoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  estadoDica: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 300,
  },
  estadoAcao: {
    marginTop: 14,
  },
});
