// Verificação de atualização — procura uma versão nova do aplicativo.
//
// O hook cuida de tudo que o usuário vê: consulta o servidor, compara com a
// versão instalada e, quando existe versão nova, abre um aviso com o botão
// de download. Nada é inventado — se o servidor não responder, o aplicativo
// apenas não avisa (na checagem automática) ou explica o motivo (quando o
// usuário pede a busca na tela de Ajustes).

import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { useModal } from '../contexts/ModalContext';
import { verificarAtualizacao } from '../services/versao';

export interface ResultadoUseVerificacaoAtualizacao {
  /** Verdadeiro enquanto a consulta ao servidor está em andamento. */
  verificando: boolean;
  /**
   * Procura uma versão nova.
   *
   * @param mostrarResultado Quando verdadeiro (uso manual), o aplicativo
   *        avisa mesmo que já esteja na versão mais recente. Na checagem
   *        automática o silêncio é o esperado.
   */
  consultar: (mostrarResultado?: boolean) => Promise<void>;
}

export function useVerificacaoAtualizacao(): ResultadoUseVerificacaoAtualizacao {
  const { abrirPersonalizado, toastSucesso, toastErro } = useModal();
  const [verificando, setVerificando] = useState(false);

  // Trava de execução — fica em uma ref para não alterar a identidade da
  // função `consultar` (o que reiniciaria a checagem automática).
  const emAndamento = useRef(false);

  const consultar = useCallback(
    async (mostrarResultado = false) => {
      if (emAndamento.current) return;

      emAndamento.current = true;
      setVerificando(true);

      try {
        const resultado = await verificarAtualizacao();

        if (!resultado.atualizada) {
          if (mostrarResultado) {
            toastSucesso('Você já está usando a versão mais recente.');
          }
          return;
        }

        // Monta o aviso com o que o servidor realmente informou.
        const linhas = [
          `A versão ${resultado.versaoPublicada} está disponível para download.`,
          'Instale por cima do aplicativo atual: seus favoritos, playlists, histórico e downloads continuam no aparelho.',
        ];

        if (resultado.notas) {
          linhas.push(resultado.notas);
        }

        abrirPersonalizado('info', 'Nova versão disponível', linhas.join('\n\n'), [
          {
            texto: 'Agora não',
            onPress: () => {},
            estilo: 'secundario',
          },
          {
            texto: 'Baixar',
            onPress: () => {
              if (resultado.url) {
                // Abre o endereço de download no navegador do aparelho.
                void Linking.openURL(resultado.url);
              }
            },
            estilo: 'primario',
          },
        ]);
      } catch (erro) {
        if (mostrarResultado) {
          toastErro(
            erro instanceof Error
              ? erro.message
              : 'Não foi possível procurar atualizações agora.'
          );
        }
      } finally {
        emAndamento.current = false;
        setVerificando(false);
      }
    },
    [abrirPersonalizado, toastSucesso, toastErro]
  );

  return { verificando, consultar };
}
