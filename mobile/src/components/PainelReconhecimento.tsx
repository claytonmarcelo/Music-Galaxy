// Painel de reconhecimento sonoro.
//
// Aparece logo abaixo do campo de busca quando há uma identificação em
// andamento ou quando o aplicativo acabou de tentar identificar uma música.
// Mostra o que está acontecendo (preparando, contagem, gravação, envio) e,
// no fim, o desfecho: a faixa reconhecida ou a ausência de resultado.
//
// Regras de honestidade da interface:
//   - Nunca mostra um título inventado: o texto exibido vem exatamente do
//     serviço de reconhecimento, e sem correspondência o painel diz que não
//     encontrou a música.
//   - O botão de pesquisa só aparece quando existe título reconhecido.
//   - Todas as cores vêm dos tokens do tema.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { RecognitionResult } from '../types';
import GlassCard from './GlassCard';
import Icone, { NomeIcone } from './Icone';
import CustomButton from './CustomButton';
import { TIMINGS, USE_NATIVE_DRIVER, pulsar } from '../utils/animacoes';
import { comAlfa } from '../utils/cores';
import { EstadoReconhecimento } from '../hooks/useReconhecimentoSonoro';

interface PainelReconhecimentoProps {
  estado: EstadoReconhecimento;
  contagem: number;
  resultado: RecognitionResult | null;
  mensagemErro: string | null;
  /** Chamado quando o usuário quer pesquisar a faixa reconhecida. */
  aoPesquisar: (termo: string) => void;
  /** Chamado para tentar a identificação outra vez. */
  aoTentarNovamente: () => void;
  /** Chamado para fechar o painel e liberar o microfone. */
  aoCancelar: () => void;
}

/** Monta o texto de busca a partir do que o serviço realmente identificou. */
function montarTermoBusca(resultado: RecognitionResult | null): string {
  if (!resultado) return '';

  const partes = [resultado.title, resultado.artist].filter(
    (parte): parte is string => typeof parte === 'string' && parte.trim().length > 0
  );

  return partes.join(' ').trim();
}

/** Descrição do que o painel mostra em cada etapa da captura. */
function descricaoDoEstado(estado: EstadoReconhecimento): {
  titulo: string;
  detalhe: string;
  icone: NomeIcone;
} {
  switch (estado) {
    case 'preparando':
      return {
        titulo: 'Preparando o microfone',
        detalhe: 'Autorize o uso do microfone para identificar a música.',
        icone: 'microfone',
      };
    case 'contando':
      return {
        titulo: 'Aproxime o aparelho da fonte',
        detalhe: 'A captura começa em instantes.',
        icone: 'relogio',
      };
    case 'gravando':
      return {
        titulo: 'Ouvindo…',
        detalhe: 'Deixe a música tocar por alguns segundos.',
        icone: 'microfone',
      };
    case 'enviando':
      return {
        titulo: 'Identificando a música',
        detalhe: 'A amostra está sendo analisada pelo servidor.',
        icone: 'ondas',
      };
    default:
      return {
        titulo: 'Reconhecimento sonoro',
        detalhe: 'Toque no microfone para identificar a música que está tocando.',
        icone: 'microfone',
      };
  }
}

export default function PainelReconhecimento({
  estado,
  contagem,
  resultado,
  mensagemErro,
  aoPesquisar,
  aoTentarNovamente,
  aoCancelar,
}: PainelReconhecimentoProps): React.JSX.Element | null {
  const { colors } = useTheme();

  const pulso = useRef(new Animated.Value(1)).current;
  const entrada = useRef(new Animated.Value(0)).current;

  const emAndamento =
    estado === 'preparando' || estado === 'contando' || estado === 'gravando' || estado === 'enviando';

  const semCorrespondencia = estado === 'concluido' && resultado?.status === 'no_match';
  const comFaixa = estado === 'concluido' && resultado?.status === 'matched';
  const comErro = estado === 'erro';

  // O painel entra com suavidade e some quando não há nada a mostrar.
  const visivel = emAndamento || semCorrespondencia || comFaixa || comErro;

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: visivel ? 1 : 0,
      duration: TIMINGS.normal,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visivel, entrada]);

  // Pulso suave durante a gravação — sinaliza que o microfone está ativo.
  useEffect(() => {
    pulsar(pulso, estado === 'gravando');
  }, [estado, pulso]);

  if (!visivel) return null;

  const descricao = descricaoDoEstado(estado);
  const termo = montarTermoBusca(resultado);

  const corDestaque =
    comErro || semCorrespondencia ? colors.warning : colors.primary;

  return (
    <Animated.View
      style={{
        opacity: entrada,
        transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      <GlassCard style={styles.cartao} forte>
        <View style={styles.cabecalho}>
          <View
            style={[
              styles.iconeMoldura,
              {
                backgroundColor: comAlfa(corDestaque, 0.14),
                borderColor: comAlfa(corDestaque, 0.32),
              },
            ]}
          >
            {emAndamento ? (
              <ActivityIndicator size="small" color={corDestaque} />
            ) : (
              <Icone
                nome={comErro ? 'aviso' : semCorrespondencia ? 'info' : 'sucessoCirculo'}
                tamanho={18}
                cor={corDestaque}
              />
            )}
          </View>

          <View style={styles.textos}>
            <Text style={[styles.titulo, { color: colors.text }]}>
              {comErro
                ? 'Não foi possível identificar'
                : semCorrespondencia
                  ? 'Música não encontrada'
                  : comFaixa
                    ? 'Música identificada'
                    : descricao.titulo}
            </Text>

            <Text style={[styles.detalhe, { color: colors.textSecondary }]}>
              {comErro
                ? mensagemErro ?? 'Não foi possível identificar a música agora.'
                : semCorrespondencia
                  ? 'O trecho capturado não corresponde a nenhuma faixa do catálogo. Nada foi preenchido na busca.'
                  : comFaixa
                    ? 'Confira abaixo e pesquise a faixa no Music Galaxy.'
                    : descricao.detalhe}
            </Text>
          </View>
        </View>

        {/* Contagem regressiva e estado de gravação */}
        {(estado === 'contando' || estado === 'gravando') && (
          <View
            style={[
              styles.faixaEstado,
              { backgroundColor: comAlfa(corDestaque, 0.1), borderColor: comAlfa(corDestaque, 0.26) },
            ]}
          >
            {estado === 'contando' ? (
              <>
                <Text style={[styles.contagemNumero, { color: corDestaque }]}>
                  {contagem}
                </Text>
                <Text style={[styles.contagemTexto, { color: colors.textSecondary }]}>
                  segundos até a captura começar
                </Text>
              </>
            ) : (
              <>
                <Animated.View
                  style={[
                    styles.pulso,
                    { borderColor: corDestaque, opacity: pulso },
                  ]}
                />
                <Text style={[styles.contagemTexto, { color: colors.textSecondary }]}>
                  Capturando o som do ambiente…
                </Text>
              </>
            )}
          </View>
        )}

        {/* Faixa reconhecida — dados vindos do serviço, sem invenção */}
        {comFaixa && resultado && (
          <View
            style={[
              styles.faixaEncontrada,
              { backgroundColor: comAlfa(colors.primary, 0.1), borderColor: comAlfa(colors.primary, 0.26) },
            ]}
          >
            <Icone nome="musica" tamanho={16} cor={colors.primary} />
            <View style={styles.faixaTextos}>
              <Text style={[styles.faixaTitulo, { color: colors.text }]} numberOfLines={2}>
                {resultado.title ?? 'Título não informado'}
              </Text>
              {resultado.artist && (
                <Text style={[styles.faixaSubtitulo, { color: colors.textSecondary }]} numberOfLines={1}>
                  {resultado.artist}
                  {resultado.album ? ` • ${resultado.album}` : ''}
                </Text>
              )}
            </View>
            {typeof resultado.confidence === 'number' && (
              <Text style={[styles.faixaConfianca, { color: colors.textSecondary }]}>
                {Math.round(resultado.confidence)}%
              </Text>
            )}
          </View>
        )}

        {/* Ações do painel */}
        <View style={styles.acoes}>
          {comFaixa && termo.length > 0 && (
            <View style={styles.botaoAcao}>
              <CustomButton
                title="Pesquisar no Music Galaxy"
                onPress={() => aoPesquisar(termo)}
                variant="primary"
                size="small"
                icone="busca"
              />
            </View>
          )}

          {(comErro || semCorrespondencia) && (
            <View style={styles.botaoAcao}>
              <CustomButton
                title="Tentar novamente"
                onPress={aoTentarNovamente}
                variant="secondary"
                size="small"
                icone="recarregar"
              />
            </View>
          )}

          {comFaixa && (
            <View style={styles.botaoAcao}>
              <CustomButton
                title="Tentar novamente"
                onPress={aoTentarNovamente}
                variant="ghost"
                size="small"
                icone="recarregar"
              />
            </View>
          )}

          <View style={styles.botaoAcao}>
            <CustomButton
              title={emAndamento ? 'Cancelar' : 'Fechar'}
              onPress={aoCancelar}
              variant="ghost"
              size="small"
              icone="limpar"
            />
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconeMoldura: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  textos: {
    flex: 1,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  detalhe: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  faixaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  contagemNumero: {
    fontSize: 22,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  contagemTexto: {
    fontSize: 12,
    flex: 1,
  },
  pulso: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  faixaEncontrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  faixaTextos: {
    flex: 1,
  },
  faixaTitulo: {
    fontSize: 14,
    fontWeight: '700',
  },
  faixaSubtitulo: {
    fontSize: 12,
    marginTop: 2,
  },
  faixaConfianca: {
    fontSize: 12,
    fontWeight: '700',
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  botaoAcao: {
    // Os botões ficam no tamanho do próprio texto e nunca são espremidos:
    // quando não cabem na linha, descem para a linha de baixo.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
});
