// Player de áudio do Music Galaxy.
// Reproduz exclusivamente o stream do backend, que resolve a fonte em
// sites abertos da web (Regra 3 — nunca plataformas de música).
// O componente funciona tanto na tela de detalhes quanto embutido no card
// (modo compacto), sempre com os tokens e ícones da identidade do app.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import SliderModule from '@react-native-community/slider';
import { playerAudio, EstadoPlayer } from '../services/playerAudio';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import { TIMINGS, USE_NATIVE_DRIVER } from '../utils/animacoes';
import { comAlfa } from '../utils/cores';
import Icone from './Icone';

interface Props {
  url: string;
  titulo: string;
  artista?: string;
  // Modo embutido no card: sem cartão próprio e com controles menores.
  compacto?: boolean;
}

// Tipagem mínima do slider nativo usada nesta tela (evita any).
interface PropsSlider {
  style?: StyleProp<ViewStyle>;
  minimumValue?: number;
  maximumValue?: number;
  value?: number;
  onValueChange?: (valor: number) => void;
  onSlidingComplete?: (valor: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  disabled?: boolean;
}

const Slider = SliderModule as unknown as React.ComponentType<PropsSlider>;

export default function PlayerControls({
  url,
  titulo,
  artista,
  compacto = false,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { toastErro } = useModal();

  const [estado, setEstado] = useState<EstadoPlayer>(playerAudio.obterEstado());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Fração exibida durante o arrasto do slider (null = posição real).
  const [arrastando, setArrastando] = useState<number | null>(null);

  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const urlRef = useRef(url);

  // Mantém a URL atual em uma ref para a limpeza de desmontagem.
  useEffect(() => {
    urlRef.current = url;
    setErro(null);
  }, [url]);

  // Acompanha o player global e anima a entrada do painel.
  useEffect(() => {
    const cancelarInscricao = playerAudio.subscribe(setEstado);

    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    return () => {
      cancelarInscricao();
      // Interrompe apenas se a faixa que está no player é a deste componente.
      const atual = playerAudio.obterEstado();
      if (atual.urlAtual === urlRef.current && (atual.tocando || atual.pausado)) {
        playerAudio.parar().catch(() => undefined);
      }
    };
  }, [fadeInAnim]);

  const ehEstaFaixa = estado.urlAtual === url;
  const tocando = ehEstaFaixa && estado.tocando;
  const duracao = ehEstaFaixa ? estado.duracao : 0;
  const tempo = arrastando !== null ? arrastando * duracao : ehEstaFaixa ? estado.tempo : 0;
  const progresso = duracao > 0 ? Math.min(tempo / duracao, 1) : 0;

  const alternarReproducao = async () => {
    if (!url) {
      setErro('Nenhuma fonte de áudio disponível para esta versão.');
      toastErro('Nenhuma fonte de áudio disponível para esta versão.');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      if (tocando) {
        await playerAudio.pausar();
      } else if (ehEstaFaixa && estado.pausado) {
        await playerAudio.retomar();
      } else {
        await playerAudio.tocar(url);
      }
    } catch (falha) {
      const mensagem =
        falha instanceof Error
          ? falha.message
          : 'Não foi possível reproduzir esta versão.';
      setErro(mensagem);
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const pararReproducao = async () => {
    setCarregando(true);
    try {
      await playerAudio.parar();
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : 'Erro ao parar a reprodução.';
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const buscarPosicao = async (fracao: number) => {
    try {
      if (duracao > 0) {
        await playerAudio.buscar(fracao * duracao);
      }
    } catch {
      // Um toque no slider nunca deve interromper a experiência com um alerta.
      setArrastando(null);
    }
  };

  const formatarTempo = (ms: number): string => {
    if (!ms || ms <= 0) return '0:00';
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
  };

  const rotuloBotao = carregando
    ? 'Carregando'
    : tocando
      ? 'Pausar'
      : ehEstaFaixa && estado.pausado
        ? 'Retomar'
        : 'Reproduzir';

  return (
    <Animated.View
      style={[
        compacto ? styles.containerCompacto : styles.container,
        compacto
          ? { borderTopColor: colors.glassBorder, opacity: fadeInAnim }
          : {
              backgroundColor: colors.glassCardForte,
              borderColor: colors.glassBorder,
              shadowColor: colors.glassShadow,
              opacity: fadeInAnim,
            },
      ]}
    >
      {/* Identificação da faixa (oculta no modo compacto) */}
      {!compacto && (
        <View style={styles.info}>
          <View
            style={[
              styles.seloMusical,
              {
                backgroundColor: comAlfa(colors.luzSecundaria, 0.16),
                borderColor: comAlfa(colors.luzSecundaria, 0.3),
              },
            ]}
          >
            <Icone nome="ondas" tamanho={18} cor={colors.primary} />
          </View>
          <View style={styles.infoTextos}>
            <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
              {titulo}
            </Text>
            {artista && (
              <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
                {artista}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.etiquetaAberta,
              {
                backgroundColor: comAlfa(colors.success, 0.14),
                borderColor: comAlfa(colors.success, 0.3),
              },
            ]}
          >
            <Text style={[styles.etiquetaAbertaTexto, { color: colors.success }]}>
              Aberto
            </Text>
          </View>
        </View>
      )}

      {/* Linha do tempo */}
      <View style={styles.progressoContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={arrastando ?? progresso}
          onValueChange={setArrastando}
          onSlidingComplete={(valor) => {
            setArrastando(null);
            void buscarPosicao(valor);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          disabled={duracao <= 0}
        />
        <View style={styles.tempos}>
          <Text style={[styles.tempoTexto, { color: colors.textSecondary }]}>
            {formatarTempo(tempo)}
          </Text>
          <Text style={[styles.tempoTexto, { color: colors.textSecondary }]}>
            {formatarTempo(duracao)}
          </Text>
        </View>
      </View>

      {/* Controles */}
      <View style={styles.controles}>
        <TouchableOpacity
          style={[
            styles.botaoPrincipal,
            compacto && styles.botaoPrincipalCompacto,
            { backgroundColor: colors.button, shadowColor: colors.glassShadow },
          ]}
          onPress={alternarReproducao}
          disabled={carregando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={rotuloBotao}
        >
          {carregando ? (
            <ActivityIndicator size="small" color={colors.buttonText} />
          ) : (
            <>
              <Icone
                nome={tocando ? 'pausar' : 'reproduzir'}
                tamanho={compacto ? 14 : 17}
                cor={colors.buttonText}
              />
              <Text
                style={[
                  styles.botaoPrincipalTexto,
                  { color: colors.buttonText },
                  compacto && styles.botaoPrincipalTextoCompacto,
                ]}
              >
                {rotuloBotao}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botaoSecundario,
            compacto && styles.botaoSecundarioCompacto,
            { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
          ]}
          onPress={pararReproducao}
          disabled={carregando || (!tocando && !(ehEstaFaixa && estado.pausado))}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Parar reprodução"
        >
          <Icone nome="parar" tamanho={compacto ? 13 : 15} cor={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Mensagem de erro amigável */}
      {erro && (
        <View
          style={[
            styles.erroContainer,
            {
              backgroundColor: comAlfa(colors.error, 0.12),
              borderColor: comAlfa(colors.error, 0.3),
            },
          ]}
        >
          <Icone nome="erro" tamanho={14} cor={colors.error} />
          <Text style={[styles.erroTexto, { color: colors.error }]}>{erro}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 26,
    padding: 18,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  containerCompacto: {
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  seloMusical: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  artista: {
    fontSize: 12,
    fontWeight: '500',
  },
  etiquetaAberta: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
  },
  etiquetaAbertaTexto: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressoContainer: {
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 28,
  },
  tempos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  tempoTexto: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  botaoPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  },
  botaoPrincipalCompacto: {
    minHeight: 40,
    paddingHorizontal: 16,
  },
  botaoPrincipalTexto: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  botaoPrincipalTextoCompacto: {
    fontSize: 12,
  },
  botaoSecundario: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSecundarioCompacto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  erroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  erroTexto: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
});
