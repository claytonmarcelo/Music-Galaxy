// Hook de reconhecimento sonoro — captura, envio e limpeza.
//
// Fluxo da identificação (o usuário sempre no comando):
//   1. Verifica a permissão do microfone e só pede se ainda não houver.
//   2. Prepara o gravador e mostra uma contagem regressiva de 3 segundos.
//   3. Grava um trecho curto (12 segundos) e para sozinho.
//   4. Lê o arquivo, envia ao backend e mostra o resultado.
//   5. Apaga o arquivo temporário e libera o microfone.
//
// Regras que o hook garante:
//   - O microfone nunca fica ativo em segundo plano: ao sair da tela ou ao
//     mandar o aplicativo para o fundo, a captura é interrompida.
//   - O áudio capturado nunca é gravado no banco nem enviado a outro lugar
//     além do backend do Music Galaxy.
//   - Um pedido por vez: iniciar durante uma tentativa cancela a anterior.
//   - Cada tentativa tem um número (geração). Tudo o que chega atrasado de
//     uma tentativa cancelada — contagem, gravação, resposta do servidor — é
//     descartado em vez de escrever por cima do estado atual.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  RecordingPresets,
  RecordingStatus,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

import { RecognitionResult, RecognitionStatus } from '../types';
import { ErroReconhecimento, reconhecerMusica } from '../services/reconhecimento';

// Duração da captura. O serviço de reconhecimento analisa trechos curtos e
// 12 segundos é o suficiente para identificar a faixa com folga.
export const DURACAO_CAPTURA_SEGUNDOS = 12;

// Contagem regressiva antes de gravar — dá tempo de aproximar o aparelho
// da fonte do som.
export const CONTAGEM_REGRESSIVA_SEGUNDOS = 3;

/** Situação do reconhecimento mostrada na interface. */
export type EstadoReconhecimento =
  | 'ocioso'
  | 'preparando'
  | 'contando'
  | 'gravando'
  | 'enviando'
  | 'concluido'
  | 'erro';

export interface ResultadoUseReconhecimentoSonoro {
  estado: EstadoReconhecimento;
  /** Segundos que faltam para a captura começar (contagem regressiva). */
  contagem: number;
  /** Resultado da última identificação bem-sucedida. */
  resultado: RecognitionResult | null;
  /** Mensagem de erro em português, quando estado = 'erro'. */
  mensagemErro: string | null;
  /**
   * Situação normalizada da falha, no mesmo contrato do backend.
   *
   * Permite que a interface diferencie "permissão negada" de "microfone
   * indisponível" ou "sem conexão" em vez de mostrar sempre a mesma frase.
   */
  statusErro: RecognitionStatus | null;
  /** Verdadeiro enquanto uma identificação está em andamento. */
  ocupado: boolean;
  /** Inicia a identificação (pede a permissão se for preciso). */
  iniciar: () => Promise<void>;
  /** Interrompe a tentativa atual e volta ao estado ocioso. */
  cancelar: () => void;
  /** Limpa o resultado exibido (sem refazer a captura). */
  limparResultado: () => void;
}

/**
 * Lê o arquivo gravado e devolve o conteúdo em base64.
 *
 * No Android e iOS o arquivo é lido pelo expo-file-system; na web o
 * gravador entrega uma URL de blob, lida pelo navegador.
 */
async function lerAudioBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const resposta = await fetch(uri);
    const blob = await resposta.blob();

    return new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não foi possível ler o áudio capturado.'));
      leitor.onload = () => {
        const resultado = typeof leitor.result === 'string' ? leitor.result : '';
        // O Data URL vem como "data:audio/webm;base64,XXXX" — só o base64
        // interessa para o backend.
        const virgula = resultado.indexOf(',');
        resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
      };
      leitor.readAsDataURL(blob);
    });
  }

  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

/** Apaga o arquivo temporário da captura (não existe arquivo na web). */
async function apagarArquivoTemporario(uri: string | null): Promise<void> {
  if (!uri) return;

  try {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(uri);
      return;
    }

    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (erro) {
    // A limpeza é best effort: o arquivo fica na pasta de cache do
    // aplicativo, que o sistema limpa sozinho.
    console.warn('Não foi possível apagar o arquivo temporário da captura:', erro);
  }
}

export function useReconhecimentoSonoro(): ResultadoUseReconhecimentoSonoro {
  const [estado, setEstado] = useState<EstadoReconhecimento>('ocioso');
  const [contagem, setContagem] = useState(CONTAGEM_REGRESSIVA_SEGUNDOS);
  const [resultado, setResultado] = useState<RecognitionResult | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [statusErro, setStatusErro] = useState<RecognitionStatus | null>(null);

  // Arquivo informado pelo gravador ao terminar a captura. No Android e iOS
  // é o caminho do arquivo; na web é a URL do blob criado.
  const urlDaCaptura = useRef<string | null>(null);

  // Temporizadores e requisições em andamento — tudo cancelável.
  const temporizadorContagem = useRef<ReturnType<typeof setTimeout> | null>(null);
  const temporizadorCaptura = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controladorRequisicao = useRef<AbortController | null>(null);
  const arquivoTemporario = useRef<string | null>(null);

  // Número da tentativa atual. Cancelar avança o número, então qualquer
  // continuação atrasada de uma tentativa antiga percebe que ficou para trás.
  const geracao = useRef(0);
  // Trava de reentrada: vale do começo da preparação até o fim do envio.
  const emAndamento = useRef(false);
  // Libera a contagem regressiva quando a tentativa é cancelada.
  const resolverContagem = useRef<(() => void) | null>(null);

  const limparTemporizadores = useCallback(() => {
    if (temporizadorContagem.current) {
      clearTimeout(temporizadorContagem.current);
      temporizadorContagem.current = null;
    }
    if (temporizadorCaptura.current) {
      clearTimeout(temporizadorCaptura.current);
      temporizadorCaptura.current = null;
    }
  }, []);

  /** Registra a falha do próprio gravador e desarma o resto da tentativa. */
  const registrarFalhaDoGravador = useCallback(
    (mensagem: string) => {
      geracao.current += 1;
      emAndamento.current = false;
      limparTemporizadores();
      setMensagemErro(mensagem);
      setStatusErro('microphone_unavailable');
      setEstado('erro');
    },
    [limparTemporizadores]
  );

  // O gravador é criado uma única vez e reaproveitado nas tentativas.
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status: RecordingStatus) => {
    if (status.url) {
      urlDaCaptura.current = status.url;
    }

    if (status.hasError) {
      // Sem desarmar aqui, o temporizador de segurança ainda dispararia mais
      // tarde e tentaria enviar um áudio que não existe.
      registrarFalhaDoGravador('A gravação foi interrompida pelo sistema. Tente novamente.');
    }
  });

  // Interrompe a captura em andamento e devolve o microfone.
  const pararGravacao = useCallback(async () => {
    try {
      if (gravador.isRecording) {
        await gravador.stop();
      }
    } catch (erro) {
      console.warn('Não foi possível encerrar a gravação:', erro);
    }
  }, [gravador]);

  /** Apaga o arquivo da última captura e cancela a requisição em voo. */
  const limparRecursos = useCallback(async () => {
    controladorRequisicao.current?.abort();
    controladorRequisicao.current = null;

    await apagarArquivoTemporario(arquivoTemporario.current);
    arquivoTemporario.current = null;
  }, []);

  const cancelar = useCallback(() => {
    const estavaEmAndamento = emAndamento.current;

    // Invalida tudo o que ainda estava em curso.
    geracao.current += 1;
    emAndamento.current = false;
    resolverContagem.current?.();
    resolverContagem.current = null;
    limparTemporizadores();

    controladorRequisicao.current?.abort();
    controladorRequisicao.current = null;

    // O trecho gravado sai do aparelho mesmo quando a tentativa é cancelada
    // antes do envio — inclusive o arquivo que o gravador ainda ia informar.
    const uri = arquivoTemporario.current ?? urlDaCaptura.current;
    arquivoTemporario.current = null;
    urlDaCaptura.current = null;

    void pararGravacao();
    void apagarArquivoTemporario(uri);

    setContagem(CONTAGEM_REGRESSIVA_SEGUNDOS);

    if (estavaEmAndamento) {
      // Cancelamento durante a captura ou o envio tem desfecho próprio na
      // interface: o usuário vê que a tentativa foi interrompida de fato.
      setResultado(null);
      setMensagemErro('A identificação foi interrompida. O microfone já foi liberado.');
      setStatusErro('cancelled');
      setEstado('erro');
      return;
    }

    setEstado('ocioso');
    setMensagemErro(null);
    setStatusErro(null);
  }, [limparTemporizadores, pararGravacao]);

  const limparResultado = useCallback(() => {
    geracao.current += 1;
    emAndamento.current = false;
    resolverContagem.current?.();
    resolverContagem.current = null;
    limparTemporizadores();
    controladorRequisicao.current?.abort();
    controladorRequisicao.current = null;
    void limparRecursos();

    setResultado(null);
    setMensagemErro(null);
    setStatusErro(null);
    setContagem(CONTAGEM_REGRESSIVA_SEGUNDOS);
    setEstado('ocioso');
  }, [limparRecursos, limparTemporizadores]);

  // Envia a amostra ao backend e trata o desfecho.
  const enviarAmostra = useCallback(async (uri: string, minhaGeracao: number) => {
    setEstado('enviando');

    let controlador: AbortController | null = null;

    try {
      const base64 = await lerAudioBase64(uri);
      if (geracao.current !== minhaGeracao) return;

      controlador = new AbortController();
      controladorRequisicao.current = controlador;

      const resposta = await reconhecerMusica(base64, controlador.signal);
      if (geracao.current !== minhaGeracao) return;

      setResultado(resposta);
      setEstado('concluido');
    } catch (erro) {
      // A tentativa foi descartada enquanto a resposta vinha: nada a fazer.
      if (geracao.current !== minhaGeracao) return;

      if (erro instanceof ErroReconhecimento && erro.status === 'cancelled') {
        setResultado(null);
        setMensagemErro('A identificação foi interrompida. O microfone já foi liberado.');
        setStatusErro('cancelled');
        setEstado('erro');
        return;
      }

      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível identificar a música agora.';
      setMensagemErro(mensagem);
      // O status vem do próprio serviço de reconhecimento; quando a falha
      // aconteceu antes do servidor (por exemplo, microfone indisponível),
      // o contrato normalizado continua valendo.
      setStatusErro(
        erro instanceof ErroReconhecimento ? erro.status : 'network_error'
      );
      setEstado('erro');
    } finally {
      if (controladorRequisicao.current === controlador) {
        controladorRequisicao.current = null;
      }
      // O arquivo temporário sai do aparelho assim que a análise termina.
      await apagarArquivoTemporario(uri);
      if (arquivoTemporario.current === uri) arquivoTemporario.current = null;
      if (geracao.current === minhaGeracao) emAndamento.current = false;
    }
  }, []);

  /** Inicia a captura depois da contagem regressiva. */
  const comecarCaptura = useCallback(async (minhaGeracao: number) => {
    try {
      setEstado('gravando');
      urlDaCaptura.current = null;

      await gravador.prepareToRecordAsync();
      if (geracao.current !== minhaGeracao) return;

      gravador.record({ forDuration: DURACAO_CAPTURA_SEGUNDOS });

      // Rede de segurança: o gravador para sozinho ao chegar na duração,
      // mas este temporizador (com folga de 1,5 s) garante o encerramento em
      // qualquer plataforma, sem disputar o fim da gravação com o gravador.
      temporizadorCaptura.current = setTimeout(() => {
        temporizadorCaptura.current = null;
        void pararGravacao().then(() => {
          if (geracao.current !== minhaGeracao) return;

          const uri = gravador.uri ?? urlDaCaptura.current;

          if (!uri) {
            // Sem arquivo não há o que enviar: encerra com motivo, em vez de
            // deixar a interface presa em "Ouvindo…".
            emAndamento.current = false;
            setMensagemErro('A gravação não produziu um áudio utilizável. Tente novamente.');
            setStatusErro('microphone_unavailable');
            setEstado('erro');
            return;
          }

          arquivoTemporario.current = uri;
          void enviarAmostra(uri, minhaGeracao);
        });
      }, DURACAO_CAPTURA_SEGUNDOS * 1000 + 1500);
    } catch (erro) {
      console.error('Falha ao iniciar a captura de áudio:', erro);
      if (geracao.current !== minhaGeracao) return;

      emAndamento.current = false;
      setMensagemErro(
        'Não foi possível acessar o microfone. Verifique as permissões do aplicativo.'
      );
      setStatusErro('microphone_unavailable');
      setEstado('erro');
    }
  }, [gravador, pararGravacao, enviarAmostra]);

  const iniciar = useCallback(async () => {
    // Um pedido por vez: iniciar de novo cancela a tentativa anterior.
    if (emAndamento.current) {
      cancelar();
      return;
    }

    const minhaGeracao = geracao.current + 1;
    geracao.current = minhaGeracao;
    emAndamento.current = true;

    setResultado(null);
    setMensagemErro(null);
    setStatusErro(null);
    setEstado('preparando');

    try {
      // 1. Permissão do microfone — só pedida na hora da ação.
      let permissao = await getRecordingPermissionsAsync();
      if (geracao.current !== minhaGeracao) return;

      if (!permissao.granted) {
        permissao = await requestRecordingPermissionsAsync();
        if (geracao.current !== minhaGeracao) return;
      }

      if (!permissao.granted) {
        emAndamento.current = false;
        setMensagemErro(
          'O microfone está bloqueado. Libere a permissão nas configurações do aparelho para identificar músicas.'
        );
        setStatusErro('permission_denied');
        setEstado('erro');
        return;
      }

      // 2. Contagem regressiva antes de começar a ouvir.
      setContagem(CONTAGEM_REGRESSIVA_SEGUNDOS);
      setEstado('contando');

      await new Promise<void>((resolve) => {
        let restantes = CONTAGEM_REGRESSIVA_SEGUNDOS;

        resolverContagem.current = () => {
          resolverContagem.current = null;
          if (temporizadorContagem.current) {
            clearTimeout(temporizadorContagem.current);
            temporizadorContagem.current = null;
          }
          resolve();
        };

        const proximo = () => {
          restantes -= 1;
          setContagem(restantes);

          if (restantes <= 0) {
            resolverContagem.current?.();
            return;
          }

          temporizadorContagem.current = setTimeout(proximo, 1000);
        };

        temporizadorContagem.current = setTimeout(proximo, 1000);
      });

      if (geracao.current !== minhaGeracao) return;

      // 3. Captura e envio.
      await comecarCaptura(minhaGeracao);
    } catch (erro) {
      if (geracao.current !== minhaGeracao) return;

      console.error('Falha no reconhecimento sonoro:', erro);
      emAndamento.current = false;
      setMensagemErro('Não foi possível iniciar a identificação. Tente novamente.');
      setStatusErro('microphone_unavailable');
      setEstado('erro');
    }
  }, [cancelar, comecarCaptura]);

  // O microfone não continua ativo com o aplicativo em segundo plano.
  useEffect(() => {
    const aoMudarEstado = (novo: AppStateStatus) => {
      if (novo !== 'active' && (emAndamento.current || gravador.isRecording)) {
        cancelar();
      }
    };

    const inscricao = AppState.addEventListener('change', aoMudarEstado);
    return () => {
      inscricao.remove();
    };
  }, [gravador, cancelar]);

  // Ao sair da tela, tudo é liberado — sem avisar a interface, que já saiu.
  useEffect(() => {
    return () => {
      geracao.current += 1;
      emAndamento.current = false;
      resolverContagem.current?.();
      resolverContagem.current = null;
      limparTemporizadores();
      void pararGravacao();
      void limparRecursos();
    };
  }, [limparTemporizadores, pararGravacao, limparRecursos]);

  return {
    estado,
    contagem,
    resultado,
    mensagemErro,
    statusErro,
    ocupado: estado === 'preparando' || estado === 'contando' || estado === 'gravando' || estado === 'enviando',
    iniciar,
    cancelar,
    limparResultado,
  };
}
