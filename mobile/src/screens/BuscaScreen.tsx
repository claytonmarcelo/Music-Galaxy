// Tela principal de busca musical.
// Reúne a identidade de vidro fosco do projeto: fundo atmosférico, campo
// de busca em pílula, atalhos de favoritos e fila de downloads, sugestões
// de histórico e o mascote do Music Galaxy no estado inicial. A busca tem
// debounce de 600 ms e só dispara a partir de 3 letras, para não gastar a
// cota das fontes externas com termos parciais.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  ListRenderItemInfo,
  Platform,
  Animated,
  ScrollView,
  Image,
  Keyboard,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { buscarMusicas } from '../services/api';
import { Release, RootStackParamList, RespostaBusca } from '../types';
import ReleaseCard from '../components/ReleaseCard';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useHistorico, ItemHistorico } from '../contexts/HistoricoContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import FiltrosModal, { Filtros } from '../components/FiltrosModal';
import { downloadManager } from '../services/downloadManager';
import { TIMINGS, USE_NATIVE_DRIVER } from '../utils/animacoes';
import Icone from '../components/Icone';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import CustomButton from '../components/CustomButton';
import BotaoTema from '../components/BotaoTema';
import PainelReconhecimento from '../components/PainelReconhecimento';
import { useReconhecimentoSonoro } from '../hooks/useReconhecimentoSonoro';
import { comAlfa, opacizar } from '../utils/cores';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Busca'>;

const DEBOUNCE_MS = 600;
const ITENS_POR_PAGINA = 30;
const MINIMO_LETRAS = 3;

// Sugestões iniciais para quem abre o aplicativo pela primeira vez.
const SUGESTOES = ['Elvis Presley', 'The Beatles', 'Queen', 'Michael Jackson'];

// Mascote do Music Galaxy: pequeno explorador musical que segura um disco.
const MASCOTE = require('../../assets/mascote.png');

export default function BuscaScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>();
  const { favoritos } = useFavoritos();
  const { historico, adicionarBusca, removerBusca, limparHistorico } = useHistorico();
  const { toastSucesso, toastErro, toastInfo } = useModal();
  const { colors, isDark, setTheme } = useTheme();

  const [termo, setTermo]           = useState('');
  const [releases, setReleases]     = useState<Release[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [fromCache, setFromCache]   = useState(false);
  // Versões do termo que ainda aguardam descoberta de fonte de áudio no
  // backend (ficam fora da lista até terem áudio resolvido)
  const [pendentesAudio, setPendentesAudio] = useState(0);
  const [focoInput, setFocoInput]   = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtros, setFiltros]       = useState<Filtros>({});
  const [resumoFila, setResumoFila] = useState({ baixando: 0, erros: 0, total: 0 });

  // Reconhecimento sonoro: identifica a música que está tocando no ambiente.
  const reconhecimento = useReconhecimentoSonoro();

  // Animações de entrada da lista e dos estados vazios.
  const fadeListaAnim = useRef(new Animated.Value(0)).current;
  const slideEstadoAnim = useRef(new Animated.Value(16)).current;
  const opacidadeEstadoAnim = useRef(new Animated.Value(0)).current;

  const timerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timerDebounce.current) clearTimeout(timerDebounce.current);
      abortController.current?.abort();
    };
  }, []);

  // Carrega a fila persistida e acompanha o andamento para o distintivo.
  const atualizarResumoFila = useCallback(() => {
    const contagem = downloadManager.obterContagem();
    setResumoFila({
      baixando: contagem.baixando,
      erros: contagem.erros,
      total: contagem.total,
    });
  }, []);

  useEffect(() => {
    let ativo = true;
    void downloadManager.initialize().then(() => {
      if (ativo) atualizarResumoFila();
    });
    const cancelarInscricao = downloadManager.assinarTodos(atualizarResumoFila);
    return () => {
      ativo = false;
      cancelarInscricao();
    };
  }, [atualizarResumoFila]);

  // Web: o navegador (Chrome, Edge e Firefox) pinta o campo de busca de
  // amarelo quando o preenchimento automático age sobre ele, e recorta esse
  // amarelo no texto — o retângulo que aparecia dentro do placeholder. O
  // truque antigo (sombra interna com o token translúcido) não resolvia,
  // porque uma cor com alfa não encobre o fundo imposto pelo navegador.
  // Aqui a cor do campo é composta em um rgb opaco e o estilo nativo de
  // preenchimento automático é neutralizado de forma definitiva, sempre com
  // os tokens do tema (nunca cores fixas).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'musicgalaxy-autofill-fix';
    let estilo = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = styleId;
      document.head.appendChild(estilo);
    }

    // Versão opaca do fundo do campo, para encobrir o que o navegador impõe.
    const fundoOpaco = opacizar(colors.input, colors.background);

    estilo.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active,
      input:-moz-autofill,
      input:-moz-autofill:hover,
      input:-moz-autofill:focus {
        -webkit-text-fill-color: ${colors.text} !important;
        -webkit-background-clip: border-box !important;
        background-color: transparent !important;
        box-shadow: 0 0 0 1000px ${fundoOpaco} inset !important;
        caret-color: ${colors.text};
        transition: background-color 0s ease 0s;
      }
    `;
  }, [colors.text, colors.input, colors.background]);

  const releasesFiltrados = useCallback(() => {
    let resultado = releases;

    if (filtros.categoria) {
      resultado = resultado.filter((r) => r.release_type_category === filtros.categoria);
    }

    if (filtros.anoMin !== undefined && filtros.anoMax !== undefined) {
      resultado = resultado.filter((r) => {
        if (!r.release_year) return false;
        return r.release_year >= filtros.anoMin! && r.release_year <= filtros.anoMax!;
      });
    }

    return resultado;
  }, [releases, filtros]);

  const listaFiltrada = releasesFiltrados();

  // Anima a lista sempre que há resultados visíveis.
  useEffect(() => {
    if (listaFiltrada.length > 0) {
      Animated.timing(fadeListaAnim, {
        toValue: 1,
        duration: TIMINGS.normal,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      fadeListaAnim.setValue(0);
    }
  }, [listaFiltrada.length, fadeListaAnim]);

  // Anima os estados vazios (erro, sem resultado, aguardando áudio).
  useEffect(() => {
    if (listaFiltrada.length === 0) {
      slideEstadoAnim.setValue(16);
      opacidadeEstadoAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideEstadoAnim, {
          toValue: 0,
          duration: TIMINGS.normal,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacidadeEstadoAnim, {
          toValue: 1,
          duration: TIMINGS.normal,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [listaFiltrada.length, carregando, erro, termo, slideEstadoAnim, opacidadeEstadoAnim]);

  const executarBusca = useCallback(async (
    termoBusca: string,
    paginaOffset: number,
    acumular: boolean
  ) => {
    if (!termoBusca.trim()) {
      setReleases([]);
      setTotal(0);
      setErro(null);
      return;
    }

    abortController.current?.abort();
    abortController.current = new AbortController();

    setCarregando(true);
    setErro(null);

    try {
      const resultado: RespostaBusca = await buscarMusicas(termoBusca.trim(), {
        limit:  ITENS_POR_PAGINA,
        offset: paginaOffset,
        sinal:  abortController.current.signal,
      });

      if (resultado.success) {
        setReleases((prev) => acumular ? [...prev, ...resultado.data.results] : resultado.data.results);
        setTotal(resultado.data.total);
        setFromCache(resultado.data.fromCache);
        setPendentesAudio(resultado.data.pendentes_audio ?? 0);

        if (!acumular && termoBusca.trim()) {
          adicionarBusca(termoBusca.trim());
          // Mensagem com plural correto em português.
          const quantidade = resultado.data.results.length;
          const pendentes  = resultado.data.pendentes_audio ?? 0;
          if (quantidade === 1) {
            toastSucesso('Encontrada 1 versão!');
          } else if (quantidade > 1) {
            toastSucesso(`Encontradas ${quantidade} versões!`);
          } else if (pendentes > 0) {
            // O backend achou versões do termo, mas ainda está resolvendo o
            // áudio delas em sites abertos — avisa em vez de dizer "0 versões".
            toastInfo(`Localizando fontes de áudio para ${pendentes} ${pendentes === 1 ? 'versão' : 'versões'}...`);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const mensagem = err instanceof Error ? err.message : 'Erro ao buscar músicas.';
      setErro(mensagem);
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  }, [adicionarBusca, toastSucesso, toastErro, toastInfo]);

  const aoMudarTermo = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
    setOffset(0);

    if (timerDebounce.current) clearTimeout(timerDebounce.current);

    if (!novoTermo.trim()) {
      abortController.current?.abort();
      setReleases([]);
      setTotal(0);
      setErro(null);
      setPendentesAudio(0);
      setCarregando(false);
      return;
    }

    // Evita ingerir termos parciais ("da", "daf") que gastam cota das APIs
    // externas e poluem o banco com buscas sem sentido.
    if (novoTermo.trim().length < MINIMO_LETRAS) {
      setCarregando(false);
      return;
    }

    timerDebounce.current = setTimeout(() => {
      executarBusca(novoTermo, 0, false);
    }, DEBOUNCE_MS);
  }, [executarBusca]);

  const enviarBusca = useCallback(() => {
    if (termo.trim().length < MINIMO_LETRAS) {
      if (termo.trim().length > 0) {
        toastInfo(`Digite pelo menos ${MINIMO_LETRAS} letras para buscar.`);
      }
      return;
    }
    if (timerDebounce.current) clearTimeout(timerDebounce.current);
    Keyboard.dismiss();
    setFocoInput(false);
    setOffset(0);
    void executarBusca(termo, 0, false);
  }, [termo, executarBusca, toastInfo]);

  const carregarMais = useCallback(() => {
    if (carregando || releases.length >= total) return;
    const novoOffset = offset + ITENS_POR_PAGINA;
    setOffset(novoOffset);
    void executarBusca(termo, novoOffset, true);
  }, [carregando, releases.length, total, offset, termo, executarBusca]);

  const limparBusca = useCallback(() => {
    if (timerDebounce.current) clearTimeout(timerDebounce.current);
    abortController.current?.abort();
    setTermo('');
    setReleases([]);
    setTotal(0);
    setErro(null);
    setPendentesAudio(0);
    setOffset(0);
  }, []);

  const selecionarSugestao = useCallback((termoSugerido: string) => {
    setTermo(termoSugerido);
    setFocoInput(false);
    Keyboard.dismiss();
    setOffset(0);
    void executarBusca(termoSugerido, 0, false);
  }, [executarBusca]);

  // ==========================================================
  // Reconhecimento sonoro
  // ==========================================================
  // Inicia a identificação a partir do botão de microfone. Um pedido por
  // vez: tocar novamente durante uma tentativa cancela a anterior.
  const iniciarReconhecimento = useCallback(() => {
    Keyboard.dismiss();
    setFocoInput(false);
    void reconhecimento.iniciar();
  }, [reconhecimento]);

  // Envia a faixa reconhecida para a busca normal — o mesmo caminho usado
  // pelas sugestões e pelo histórico, sem inventar termos.
  const pesquisarFaixaReconhecida = useCallback((termoFaixa: string) => {
    reconhecimento.limparResultado();
    selecionarSugestao(termoFaixa);
  }, [reconhecimento, selecionarSugestao]);

  const repetirReconhecimento = useCallback(() => {
    void reconhecimento.iniciar();
  }, [reconhecimento]);

  const encerrarReconhecimento = useCallback(() => {
    reconhecimento.cancelar();
  }, [reconhecimento]);

  const removerSugestao = useCallback(async (
    termoRemover: string,
    evento: GestureResponderEvent
  ) => {
    evento.stopPropagation();
    await removerBusca(termoRemover);
    toastSucesso(`"${termoRemover}" removido do histórico`);
  }, [removerBusca, toastSucesso]);

  const aplicarFiltros = useCallback((novosFiltros: Filtros) => {
    setFiltros(novosFiltros);
    toastSucesso('Filtros aplicados!');
  }, [toastSucesso]);

  const limparFiltros = useCallback(() => {
    setFiltros({});
    toastSucesso('Filtros removidos');
  }, [toastSucesso]);

  const contadorFiltros =
    (filtros.categoria ? 1 : 0) + (filtros.anoMin !== undefined ? 1 : 0);

  const filaEmAndamento = resumoFila.baixando + resumoFila.erros;

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Release>) => (
    <ReleaseCard
      release={item}
      onPress={() => navigation.navigate('DetalheRelease', { release: item })}
    />
  ), [navigation]);

  const keyExtractor = useCallback((item: Release) => String(item.id), []);

  const ListFooter = useCallback(() => {
    if (carregando && releases.length > 0) {
      return <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />;
    }
    if (!carregando && listaFiltrada.length >= total && total > 0) {
      return (
        <Text style={[styles.fimLista, { color: colors.textSecondary }]}>
          {listaFiltrada.length} de {total} {total === 1 ? 'versão' : 'versões'}
        </Text>
      );
    }
    return null;
  }, [carregando, releases.length, listaFiltrada.length, total, colors]);

  const ListHeader = useCallback(() => (
    <View style={styles.headerLista}>
      <View style={styles.headerListaLinha}>
        <Text style={[styles.headerTexto, { color: colors.text }]}>
          {listaFiltrada.length} {listaFiltrada.length === 1 ? 'versão' : 'versões'}
        </Text>
        <View
          style={[
            styles.chipFonte,
            { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
          ]}
        >
          <Icone
            nome={fromCache ? 'banco' : 'ondas'}
            tamanho={11}
            cor={colors.textSecondary}
          />
          <Text style={[styles.chipFonteTexto, { color: colors.textSecondary }]}>
            {fromCache ? 'Banco local' : 'Buscado agora'}
          </Text>
        </View>
      </View>

      {pendentesAudio > 0 && (
        <View
          style={[
            styles.avisoPendentes,
            {
              backgroundColor: comAlfa(colors.warning, 0.1),
              borderColor: comAlfa(colors.warning, 0.28),
            },
          ]}
        >
          <Icone nome="relogio" tamanho={14} cor={colors.warning} />
          <Text style={[styles.avisoPendentesTexto, { color: colors.warning }]}>
            {pendentesAudio} {pendentesAudio === 1 ? 'versão aguardando' : 'versões aguardando'} fonte de áudio
          </Text>
        </View>
      )}
    </View>
  ), [listaFiltrada.length, colors, fromCache, pendentesAudio]);

  return (
    <FundoAtmosfera>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Cabeçalho da marca e atalhos rápidos */}
        <View style={styles.cabecalho}>
          <View style={styles.marca}>
            <View style={styles.marcaEtiqueta}>
              <View style={[styles.pontoMarca, { backgroundColor: colors.primary }]} />
              <Text style={[styles.marcaEtiquetaTexto, { color: colors.textSecondary }]}>
                UNIVERSO MUSICAL
              </Text>
            </View>
            <Text style={[styles.titulo, { color: colors.text }]}>Music Galaxy</Text>
          </View>

          <View style={styles.acoesCabecalho}>
            <BotaoTema onAlternar={() => setTheme(isDark ? 'light' : 'dark')} />

            <TouchableOpacity
              style={[
                styles.botaoCabecalho,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => navigation.navigate('FilaDownloads')}
              activeOpacity={0.75}
              accessibilityLabel="Abrir fila de downloads"
            >
              <Icone nome="download" tamanho={19} cor={colors.text} />
              {filaEmAndamento > 0 && (
                <View style={[styles.badgeContador, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeContadorTexto, { color: colors.buttonText }]}>
                    {filaEmAndamento > 9 ? '9+' : filaEmAndamento}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botaoCabecalho,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => navigation.navigate('Favoritos')}
              activeOpacity={0.75}
              accessibilityLabel="Ver favoritos"
            >
              <Icone nome="favorito" tamanho={19} cor={colors.text} />
              {favoritos.length > 0 && (
                <View style={[styles.badgeContador, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeContadorTexto, { color: colors.buttonText }]}>
                    {favoritos.length > 9 ? '9+' : favoritos.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Campo de busca em pílula e botão de filtros */}
        <View style={styles.campoBuscaContainer}>
          <View
            style={[
              styles.campoBusca,
              {
                backgroundColor: colors.input,
                borderColor: focoInput ? colors.primary : colors.glassBorder,
              },
              focoInput && {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18,
                shadowRadius: 14,
                elevation: 6,
              },
            ]}
          >
            <Icone nome="busca" tamanho={18} cor={focoInput ? colors.primary : colors.textSecondary} />
            {/* O placeholder é um Text próprio sobreposto ao campo: no Android,
                o autofill do sistema pinta o placeholder nativo de amarelo e
                ignora o placeholderTextColor. Assim a cor vem SEMPRE do token
                textSecondary, em qualquer plataforma. */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={termo}
                onChangeText={aoMudarTermo}
                onSubmitEditing={enviarBusca}
                onFocus={() => setFocoInput(true)}
                onBlur={() => setTimeout(() => setFocoInput(false), 200)}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                // Campo de pesquisa não tem nada a ver com preenchimento
                // automático: desligar evita o amarelo do navegador.
                autoComplete="off"
                accessibilityLabel="Campo de busca musical"
              />
              {termo.length === 0 && (
                <Text
                  pointerEvents="none"
                  numberOfLines={1}
                  style={[styles.placeholderTexto, { color: colors.textSecondary }]}
                >
                  Artista, música ou álbum...
                </Text>
              )}
            </View>
            {/* Botão de reconhecimento sonoro — fica dentro da pílula para
                não competir com o botão de filtros. */}
            <TouchableOpacity
              style={[
                styles.botaoMicrofone,
                {
                  backgroundColor: reconhecimento.ocupado
                    ? comAlfa(colors.primary, 0.18)
                    : comAlfa(colors.primary, 0.08),
                  borderColor: comAlfa(colors.primary, reconhecimento.ocupado ? 0.5 : 0.22),
                },
              ]}
              onPress={iniciarReconhecimento}
              activeOpacity={0.75}
              accessibilityLabel="Identificar a música que está tocando"
            >
              <Icone
                nome="microfone"
                tamanho={16}
                cor={colors.primary}
              />
            </TouchableOpacity>
            {termo.length > 0 && (
              <TouchableOpacity
                onPress={limparBusca}
                style={styles.botaoLimpar}
                activeOpacity={0.7}
                accessibilityLabel="Limpar busca"
              >
                <Icone nome="limpar" tamanho={16} cor={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.botaoFiltros,
              {
                backgroundColor: contadorFiltros > 0 ? comAlfa(colors.primary, 0.16) : colors.glassCard,
                borderColor: contadorFiltros > 0 ? colors.primary : colors.glassBorder,
              },
            ]}
            onPress={() => setMostrarFiltros(true)}
            activeOpacity={0.75}
            accessibilityLabel="Abrir filtros"
          >
            <Icone
              nome="filtro"
              tamanho={19}
              cor={contadorFiltros > 0 ? colors.primary : colors.text}
            />
            {contadorFiltros > 0 && (
              <View style={[styles.badgeFiltros, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeFiltrosTexto, { color: colors.buttonText }]}>
                  {contadorFiltros}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Painel de reconhecimento sonoro — aparece só quando há
            identificação em andamento ou resultado a mostrar. */}
        <PainelReconhecimento
          estado={reconhecimento.estado}
          contagem={reconhecimento.contagem}
          resultado={reconhecimento.resultado}
          mensagemErro={reconhecimento.mensagemErro}
          aoPesquisar={pesquisarFaixaReconhecida}
          aoTentarNovamente={repetirReconhecimento}
          aoCancelar={encerrarReconhecimento}
        />

        {/* Aviso de mínimo de letras */}
        {termo.trim().length > 0 && termo.trim().length < MINIMO_LETRAS && (
          <Text style={[styles.dicaMinimo, { color: colors.textSecondary }]}>
            Digite pelo menos {MINIMO_LETRAS} letras para buscar.
          </Text>
        )}

        {/* Buscas recentes em pílulas removíveis */}
        {termo.trim().length === 0 && historico.length > 0 && (
          <View style={styles.historicoContainer}>
            <View style={styles.historicoCabecalho}>
              <View style={styles.historicoTituloLinha}>
                <Icone nome="relogio" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.historicoTitulo, { color: colors.textSecondary }]}>
                  Buscas recentes
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  void limparHistorico();
                  toastSucesso('Histórico de buscas limpo');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Limpar histórico de buscas"
              >
                <Text style={[styles.historicoLimpar, { color: colors.primary }]}>Limpar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historicoChips}>
              {historico.slice(0, 6).map((item: ItemHistorico) => (
                <TouchableOpacity
                  key={item.termo}
                  style={[
                    styles.chipHistorico,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                  onPress={() => selecionarSugestao(item.termo)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.chipHistoricoTexto, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.termo}
                  </Text>
                  <TouchableOpacity
                    style={styles.chipHistoricoRemover}
                    onPress={(evento) => removerSugestao(item.termo, evento)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Remover ${item.termo} do histórico`}
                  >
                    <Icone nome="limpar" tamanho={11} cor={colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Estado inicial: convite para explorar com o mascote */}
        {termo.trim().length === 0 && !carregando && !erro && (
          <ScrollView
            contentContainerStyle={styles.estadoInicialScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                opacity: opacidadeEstadoAnim,
                transform: [{ translateY: slideEstadoAnim }],
              }}
            >
              <GlassCard style={styles.hero}>
                <View style={styles.heroLinha}>
                  <View style={styles.heroTexto}>
                    <View
                      style={[
                        styles.heroEtiqueta,
                        { backgroundColor: comAlfa(colors.primary, 0.14), borderColor: comAlfa(colors.primary, 0.3) },
                      ]}
                    >
                      <Icone nome="ondas" tamanho={11} cor={colors.primary} />
                      <Text style={[styles.heroEtiquetaTexto, { color: colors.primary }]}>
                        FONTES ABERTAS
                      </Text>
                    </View>
                    <Text style={[styles.heroTitulo, { color: colors.text }]}>
                      Explore o universo musical
                    </Text>
                    <Text style={[styles.heroSubtitulo, { color: colors.textSecondary }]}>
                      Encontre todas as versões de uma obra e ouça ou baixe em MP3 e FLAC.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.mascoteMoldura,
                      { backgroundColor: colors.glassCardForte, borderColor: colors.glassBorder },
                    ]}
                  >
                    <Image
                      source={MASCOTE}
                      style={styles.mascote}
                      resizeMode="cover"
                      accessibilityLabel="Mascote do Music Galaxy segurando um disco"
                    />
                  </View>
                </View>

                <View style={[styles.heroDivisor, { backgroundColor: colors.glassBorder }]} />

                <Text style={[styles.sugestoesTitulo, { color: colors.textSecondary }]}>
                  Sugestões para começar
                </Text>
                <View style={styles.sugestoesChips}>
                  {SUGESTOES.map((sugestao) => (
                    <TouchableOpacity
                      key={sugestao}
                      style={[
                        styles.chipSugestao,
                        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                      ]}
                      onPress={() => selecionarSugestao(sugestao)}
                      activeOpacity={0.7}
                    >
                      <Icone nome="musica" tamanho={12} cor={colors.primary} />
                      <Text style={[styles.chipSugestaoTexto, { color: colors.text }]}>
                        {sugestao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.heroRodape}>
                  <View style={styles.heroRodapeItem}>
                    <Icone nome="escudo" tamanho={12} cor={colors.textSecondary} />
                    <Text style={[styles.heroRodapeTexto, { color: colors.textSecondary }]}>
                      Somente fontes abertas
                    </Text>
                  </View>
                  <View style={styles.heroRodapeItem}>
                    <Icone nome="download" tamanho={12} cor={colors.textSecondary} />
                    <Text style={[styles.heroRodapeTexto, { color: colors.textSecondary }]}>
                      Baixe em MP3 ou FLAC
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          </ScrollView>
        )}

        {/* Carregando (primeira página) */}
        {carregando && releases.length === 0 && (
          <Animated.View style={[styles.estadoCentro, { opacity: opacidadeEstadoAnim }]}>
            <View
              style={[
                styles.estadoIconeCirculo,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
            <Text style={[styles.estadoTitulo, { color: colors.text }]}>Buscando versões</Text>
            <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
              Consultando o acervo e os sites abertos de áudio...
            </Text>
          </Animated.View>
        )}

        {/* Erro */}
        {erro && !carregando && (
          <Animated.View
            style={[
              styles.estadoCentro,
              {
                opacity: opacidadeEstadoAnim,
                transform: [{ translateY: slideEstadoAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.estadoIconeCirculo,
                { backgroundColor: comAlfa(colors.error, 0.12), borderColor: comAlfa(colors.error, 0.3) },
              ]}
            >
              <Icone nome="erro" tamanho={26} cor={colors.error} />
            </View>
            <Text style={[styles.estadoTitulo, { color: colors.text }]}>Não foi possível buscar</Text>
            <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>{erro}</Text>
            <View style={styles.estadoAcao}>
              <CustomButton
                title="Tentar novamente"
                icone="recarregar"
                onPress={() => void executarBusca(termo, 0, false)}
              />
            </View>
          </Animated.View>
        )}

        {/* Nenhum resultado com os filtros atuais */}
        {!carregando && !erro && termo.trim().length > 0 && listaFiltrada.length === 0 && releases.length > 0 && (
          <Animated.View
            style={[
              styles.estadoCentro,
              {
                opacity: opacidadeEstadoAnim,
                transform: [{ translateY: slideEstadoAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.estadoIconeCirculo,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="filtro" tamanho={24} cor={colors.textSecondary} />
            </View>
            <Text style={[styles.estadoTitulo, { color: colors.text }]}>
              Nenhum resultado com esses filtros
            </Text>
            <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
              Remova os filtros para ver todas as versões encontradas.
            </Text>
            <View style={styles.estadoAcao}>
              <CustomButton
                title="Limpar filtros"
                variant="secondary"
                icone="limpar"
                onPress={limparFiltros}
              />
            </View>
          </Animated.View>
        )}

        {/* Nenhuma versão encontrada (ou aguardando descoberta de áudio) */}
        {!carregando && !erro && termo.trim().length > 0 && releases.length === 0 && (
          <Animated.View
            style={[
              styles.estadoCentro,
              {
                opacity: opacidadeEstadoAnim,
                transform: [{ translateY: slideEstadoAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.estadoIconeCirculo,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <Icone
                nome={pendentesAudio > 0 ? 'ondas' : 'musica'}
                tamanho={26}
                cor={pendentesAudio > 0 ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.estadoTitulo, { color: colors.text }]}>
              {pendentesAudio > 0 ? 'Localizando fontes de áudio' : 'Nenhuma versão encontrada'}
            </Text>
            <Text style={[styles.estadoDica, { color: colors.textSecondary }]}>
              {pendentesAudio > 0
                ? `${pendentesAudio} ${pendentesAudio === 1 ? 'versão encontrada aguarda' : 'versões encontradas aguardam'} a descoberta do áudio em sites abertos.`
                : 'Tente outro artista, título ou jeito de escrever.'}
            </Text>
            {pendentesAudio > 0 && (
              <View style={styles.estadoAcao}>
                <CustomButton
                  title="Buscar novamente"
                  variant="secondary"
                  icone="recarregar"
                  onPress={() => void executarBusca(termo, 0, false)}
                />
              </View>
            )}
          </Animated.View>
        )}

        {/* Lista de versões */}
        {listaFiltrada.length > 0 && (
          <Animated.View style={{ flex: 1, opacity: fadeListaAnim }}>
            <FlatList
              data={listaFiltrada}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              ListHeaderComponent={ListHeader}
              ListFooterComponent={ListFooter}
              onEndReached={carregarMais}
              onEndReachedThreshold={0.3}
              contentContainerStyle={styles.lista}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          </Animated.View>
        )}

        <FiltrosModal
          visivel={mostrarFiltros}
          filtrosAtuais={filtros}
          onFechar={() => setMostrarFiltros(false)}
          onAplicar={aplicarFiltros}
          onLimpar={limparFiltros}
        />
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 6,
    paddingBottom: 14,
  },
  marca: {
    flex: 1,
  },
  marcaEtiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  pontoMarca: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  marcaEtiquetaTexto: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  acoesCabecalho: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoCabecalho: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeContador: {
    position: 'absolute',
    top: -5,
    right: -5,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeContadorTexto: {
    fontSize: 9,
    fontWeight: '800',
  },
  campoBuscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  campoBusca: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 17,
    minHeight: 54,
    borderWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  placeholderTexto: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 15,
  },
  botaoLimpar: {
    padding: 4,
  },
  botaoMicrofone: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  botaoFiltros: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badgeFiltros: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeFiltrosTexto: {
    fontSize: 9,
    fontWeight: '800',
  },
  dicaMinimo: {
    fontSize: 11,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  historicoContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
  },
  historicoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historicoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historicoTitulo: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  historicoLimpar: {
    fontSize: 11,
    fontWeight: '600',
  },
  historicoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipHistorico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 13,
    paddingRight: 7,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipHistoricoTexto: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 190,
  },
  chipHistoricoRemover: {
    padding: 3,
  },
  estadoInicialScroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 130,
    paddingTop: 24,
  },
  hero: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 30,
  },
  heroLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroTexto: {
    flex: 1,
  },
  heroEtiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  heroEtiquetaTexto: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitulo: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  heroSubtitulo: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  mascoteMoldura: {
    width: 116,
    height: 116,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  heroDivisor: {
    height: 1,
    marginVertical: 16,
  },
  sugestoesTitulo: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  sugestoesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipSugestao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipSugestaoTexto: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroRodape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 16,
  },
  heroRodapeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroRodapeTexto: {
    fontSize: 10,
    fontWeight: '500',
  },
  lista: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  headerLista: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
  },
  headerListaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipFonte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipFonteTexto: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  avisoPendentes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  avisoPendentesTexto: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
  },
  estadoCentro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 110,
  },
  estadoIconeCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  estadoTitulo: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  estadoDica: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  estadoAcao: {
    marginTop: 18,
  },
  spinner: {
    paddingVertical: 18,
  },
  fimLista: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 16,
  },
});
