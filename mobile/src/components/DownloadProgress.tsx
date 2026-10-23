// Painel de download de uma versão.
// Segue o fluxo de um gerenciador de downloads moderno: a qualidade é
// escolhida e lembrada, o progresso real aparece na hora e o arquivo pode
// ser cancelado, removido ou baixado de novo.
// Regra 3: o arquivo SEMPRE vem do endpoint do backend, que resolve a fonte
// em sites abertos da web — nunca de plataformas de música.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Release } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { downloadManager, EstadoDownload } from '../services/downloadManager';
import {
  FormatoDownload,
  OPCOES_QUALIDADE,
  QUALIDADE_PADRAO,
  obterQualidadePadrao,
  salvarQualidadePadrao,
  urlDownloadRelease,
  nomeBaseArquivoRelease,
  rotuloQualidade,
} from '../services/downloadRelease';
import { comAlfa } from '../utils/cores';
import { formatFileSize } from '../utils/helpers';
import Icone from './Icone';

interface Props {
  release: Release;
}

export default function DownloadProgress({ release }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { toastSucesso, toastErro } = useModal();

  const [qualidade, setQualidade] = useState<FormatoDownload>(QUALIDADE_PADRAO);
  const [estado, setEstado] = useState<EstadoDownload | null>(null);
  const [iniciando, setIniciando] = useState(false);

  const url = urlDownloadRelease(release.id, qualidade);

  // Carrega a preferência de qualidade e recupera a fila salva no aparelho.
  useEffect(() => {
    let ativo = true;
    (async () => {
      await downloadManager.initialize();
      const preferida = await obterQualidadePadrao();
      if (ativo) setQualidade(preferida);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Acompanha o progresso da URL correspondente à qualidade escolhida.
  useEffect(() => {
    setEstado(downloadManager.obterEstado(url));
    return downloadManager.subscribe(url, setEstado);
  }, [url]);

  const escolherQualidade = async (formato: FormatoDownload) => {
    setQualidade(formato);
    await salvarQualidadePadrao(formato);
  };

  const iniciarDownload = async () => {
    if (iniciando || estado?.baixando) return;
    setIniciando(true);
    try {
      await downloadManager.baixar(url, nomeBaseArquivoRelease(release));
      toastSucesso(`Download em ${rotuloQualidade(qualidade)} concluído!`);
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : 'Não foi possível baixar o arquivo.';
      toastErro(mensagem);
    } finally {
      setIniciando(false);
    }
  };

  const cancelarDownload = async () => {
    try {
      await downloadManager.cancelar(url);
      toastSucesso('Download cancelado.');
    } catch {
      toastErro('Não foi possível cancelar o download.');
    }
  };

  const removerArquivo = async () => {
    try {
      await downloadManager.deletar(url);
      setEstado(null);
      toastSucesso('Download removido.');
    } catch {
      toastErro('Não foi possível remover o download.');
    }
  };

  const baixando = iniciando || estado?.baixando === true;
  const concluido = estado?.concluido === true;
  const mensagemErro = estado?.erro;
  const percentual = Math.min(Math.round((estado?.progresso ?? 0) * 100), 100);
  const opcaoAtual = OPCOES_QUALIDADE.find((opcao) => opcao.formato === qualidade);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassCardForte,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
      {/* Cabeçalho */}
      <View style={styles.cabecalho}>
        <View
          style={[
            styles.selo,
            {
              backgroundColor: comAlfa(colors.primary, 0.14),
              borderColor: comAlfa(colors.primary, 0.28),
            },
          ]}
        >
          <Icone nome="download" tamanho={18} cor={colors.primary} />
        </View>
        <View style={styles.cabecalhoTextos}>
          <Text style={[styles.titulo, { color: colors.text }]}>Baixar esta versão</Text>
          <Text style={[styles.descricao, { color: colors.textSecondary }]}>
            O arquivo é gerado a partir de uma fonte aberta da web.
          </Text>
        </View>
      </View>

      {/* Escolha de qualidade */}
      <View style={styles.opcoes}>
        {OPCOES_QUALIDADE.map((opcao) => {
          const selecionada = opcao.formato === qualidade;
          return (
            <TouchableOpacity
              key={opcao.formato}
              style={[
                styles.opcao,
                {
                  backgroundColor: selecionada
                    ? comAlfa(colors.primary, 0.14)
                    : colors.glassCard,
                  borderColor: selecionada ? colors.primary : colors.glassBorder,
                },
              ]}
              onPress={() => void escolherQualidade(opcao.formato)}
              disabled={baixando}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: selecionada }}
              accessibilityLabel={`Qualidade ${opcao.titulo}`}
            >
              <View style={styles.opcaoTopo}>
                <Icone
                  nome={selecionada ? 'sucessoCirculo' : 'qualidade'}
                  tamanho={14}
                  cor={selecionada ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.opcaoTitulo,
                    { color: selecionada ? colors.primary : colors.text },
                  ]}
                >
                  {opcao.titulo}
                </Text>
              </View>
              <Text style={[styles.opcaoDescricao, { color: colors.textSecondary }]}>
                {opcao.descricao}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Progresso real */}
      {baixando && (
        <View style={styles.progressoBox}>
          <View style={styles.progressoTopo}>
            <Text style={[styles.progressoRotulo, { color: colors.text }]}>
              Baixando em {rotuloQualidade(qualidade)}
            </Text>
            <Text style={[styles.progressoPercentual, { color: colors.primary }]}>
              {percentual}%
            </Text>
          </View>
          <View style={[styles.barraFundo, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barraPreenchida,
                { backgroundColor: colors.primary, width: `${percentual}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressoTamanho, { color: colors.textSecondary }]}>
            {formatFileSize(estado?.tamanhoAtual ?? 0)} de {formatFileSize(estado?.tamanhoTotal ?? 0)}
          </Text>
        </View>
      )}

      {/* Concluído */}
      {concluido && !baixando && (
        <View
          style={[
            styles.statusBox,
            {
              backgroundColor: comAlfa(colors.success, 0.12),
              borderColor: comAlfa(colors.success, 0.3),
            },
          ]}
        >
          <Icone nome="sucessoCirculo" tamanho={18} cor={colors.success} />
          <View style={styles.statusTextos}>
            <Text style={[styles.statusTitulo, { color: colors.success }]}>
              Download concluído
            </Text>
            <Text style={[styles.statusDescricao, { color: colors.textSecondary }]}>
              {Platform.OS === 'web'
                ? 'O navegador salvou o arquivo na pasta de downloads.'
                : 'O arquivo foi salvo no aparelho.'}
            </Text>
          </View>
        </View>
      )}

      {/* Erro */}
      {!!mensagemErro && !baixando && (
        <View
          style={[
            styles.statusBox,
            {
              backgroundColor: comAlfa(colors.error, 0.12),
              borderColor: comAlfa(colors.error, 0.3),
            },
          ]}
        >
          <Icone nome="erro" tamanho={18} cor={colors.error} />
          <View style={styles.statusTextos}>
            <Text style={[styles.statusTitulo, { color: colors.error }]}>
              Download não concluído
            </Text>
            <Text style={[styles.statusDescricao, { color: colors.textSecondary }]}>
              {mensagemErro}
            </Text>
          </View>
        </View>
      )}

      {/* Ações */}
      <View style={styles.acoes}>
        {baixando ? (
          <TouchableOpacity
            style={[styles.botaoOutline, { borderColor: colors.glassBorder }]}
            onPress={cancelarDownload}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Cancelar download"
          >
            <Icone nome="limpar" tamanho={14} cor={colors.textSecondary} />
            <Text style={[styles.botaoOutlineTexto, { color: colors.textSecondary }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        ) : concluido ? (
          <TouchableOpacity
            style={[styles.botaoOutline, { borderColor: colors.glassBorder }]}
            onPress={removerArquivo}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Remover download"
          >
            <Icone nome="lixeira" tamanho={14} cor={colors.textSecondary} />
            <Text style={[styles.botaoOutlineTexto, { color: colors.textSecondary }]}>
              Remover
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.botaoPrincipal,
              { backgroundColor: colors.button, shadowColor: colors.glassShadow },
              iniciando && styles.botaoPressionado,
            ]}
            onPress={iniciarDownload}
            disabled={iniciando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Baixar em ${rotuloQualidade(qualidade)}`}
          >
            <Icone nome={mensagemErro ? 'recarregar' : 'download'} tamanho={15} cor={colors.buttonText} />
            <Text style={[styles.botaoPrincipalTexto, { color: colors.buttonText }]}>
              {mensagemErro
                ? 'Tentar novamente'
                : `Baixar ${rotuloQualidade(qualidade)}`}
            </Text>
          </TouchableOpacity>
        )}

        {opcaoAtual && !baixando && !concluido && (
          <Text style={[styles.notaQualidade, { color: colors.textSecondary }]}>
            {opcaoAtual.titulo}
          </Text>
        )}
      </View>
    </View>
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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  selo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cabecalhoTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  descricao: {
    fontSize: 11,
    lineHeight: 15,
  },
  opcoes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  opcao: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 5,
  },
  opcaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opcaoTitulo: {
    fontSize: 11,
    fontWeight: '700',
  },
  opcaoDescricao: {
    fontSize: 9,
    lineHeight: 13,
  },
  progressoBox: {
    marginBottom: 14,
  },
  progressoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  progressoRotulo: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressoPercentual: {
    fontSize: 12,
    fontWeight: '700',
  },
  barraFundo: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: 3,
  },
  progressoTamanho: {
    fontSize: 9,
    marginTop: 5,
    textAlign: 'right',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  statusTextos: {
    flex: 1,
    gap: 2,
  },
  statusTitulo: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusDescricao: {
    fontSize: 10,
    lineHeight: 14,
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botaoPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  },
  botaoPressionado: {
    opacity: 0.7,
  },
  botaoPrincipalTexto: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  botaoOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  botaoOutlineTexto: {
    fontSize: 12,
    fontWeight: '600',
  },
  notaQualidade: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
