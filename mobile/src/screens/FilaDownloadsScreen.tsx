// Tela da fila de downloads.
// Reúne todos os downloads feitos no aparelho com progresso, cancelamento,
// nova tentativa e remoção — o mesmo tipo de experiência de um gerenciador
// de downloads moderno, sempre alimentado por fontes abertas da web (Regra 3).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone from '../components/Icone';
import { comAlfa } from '../utils/cores';
import {
  downloadManager,
  EstadoDownload,
  formatoDoDownload,
} from '../services/downloadManager';

type Props = NativeStackScreenProps<RootStackParamList, 'FilaDownloads'>;

type Filtro = 'todos' | 'baixando' | 'concluidos' | 'erros';

interface ItemFila {
  url: string;
  estado: EstadoDownload;
}

const MASCOTE = require('../../assets/mascote.png');

// Formata bytes em uma medida legível.
function formatarTamanho(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / Math.pow(1024, indice);
  return `${valor.toFixed(valor >= 10 || indice === 0 ? 0 : 1)} ${unidades[indice]}`;
}

export default function FilaDownloadsScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { abrirConfirmacao, toastSucesso, toastErro } = useModal();

  const [itens, setItens] = useState<ItemFila[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [carregando, setCarregando] = useState(true);

  // Carrega a fila persistida e acompanha qualquer mudança de estado.
  useEffect(() => {
    let ativo = true;

    const atualizar = () => {
      if (ativo) setItens(downloadManager.listarEstados());
    };

    downloadManager.initialize().then(() => {
      if (!ativo) return;
      atualizar();
      setCarregando(false);
    });

    const cancelarInscricao = downloadManager.assinarTodos(atualizar);

    return () => {
      ativo = false;
      cancelarInscricao();
    };
  }, []);

  const contagem = useMemo(() => downloadManager.obterContagem(), [itens]);

  const itensFiltrados = useMemo(() => {
    switch (filtro) {
      case 'baixando':
        return itens.filter(({ estado }) => estado.baixando);
      case 'concluidos':
        return itens.filter(({ estado }) => estado.concluido);
      case 'erros':
        return itens.filter(
          ({ estado }) => !estado.baixando && !estado.concluido && !!estado.erro
        );
      default:
        return itens;
    }
  }, [itens, filtro]);

  const cancelarDownload = useCallback(async (url: string) => {
    try {
      await downloadManager.cancelar(url);
      toastSucesso('Download cancelado.');
    } catch {
      toastErro('Não foi possível cancelar o download.');
    }
  }, [toastErro, toastSucesso]);

  const removerDownload = useCallback((url: string) => {
    abrirConfirmacao(
      'Remover download?',
      'O registro sairá da fila. Na web, o arquivo já salvo pelo navegador não é apagado.',
      async () => {
        try {
          await downloadManager.deletar(url);
          toastSucesso('Download removido.');
        } catch {
          toastErro('Não foi possível remover o download.');
        }
      }
    );
  }, [abrirConfirmacao, toastErro, toastSucesso]);

  const tentarNovamente = useCallback(async (item: ItemFila) => {
    try {
      await downloadManager.baixar(
        item.url,
        item.estado.titulo ?? 'Download do Music Galaxy'
      );
      toastSucesso('Download concluído!');
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : 'Não foi possível baixar novamente.';
      toastErro(mensagem);
    }
  }, [toastErro, toastSucesso]);

  const limparConcluidos = useCallback(() => {
    abrirConfirmacao(
      'Limpar concluídos?',
      'Todos os downloads concluídos serão removidos da fila.',
      async () => {
        await downloadManager.limparConcluidos();
        toastSucesso('Downloads concluídos removidos.');
      }
    );
  }, [abrirConfirmacao, toastSucesso]);

  const limparErros = useCallback(() => {
    abrirConfirmacao(
      'Limpar erros?',
      'Os downloads que falharam serão removidos da fila.',
      async () => {
        await downloadManager.limparErros();
        toastSucesso('Downloads com erro removidos.');
      }
    );
  }, [abrirConfirmacao, toastSucesso]);

  const filtros: Array<{ chave: Filtro; rotulo: string; total: number }> = [
    { chave: 'todos', rotulo: 'Todos', total: contagem.total },
    { chave: 'baixando', rotulo: 'Baixando', total: contagem.baixando },
    { chave: 'concluidos', rotulo: 'Concluídos', total: contagem.concluidos },
    { chave: 'erros', rotulo: 'Com erro', total: contagem.erros },
  ];

  const renderItem = ({ item }: ListRenderItemInfo<ItemFila>) => {
    const { url, estado } = item;
    const percentual = Math.min(Math.round((estado.progresso ?? 0) * 100), 100);
    const formato = formatoDoDownload(url).toUpperCase();
    const baixando = estado.baixando;
    const concluido = estado.concluido;
    const mensagemErro = estado.erro;

    return (
      <GlassCard style={styles.card}>
        <View style={styles.cardTopo}>
          <View
            style={[
              styles.seloStatus,
              {
                backgroundColor: concluido
                  ? comAlfa(colors.success, 0.14)
                  : mensagemErro && !baixando
                    ? comAlfa(colors.error, 0.14)
                    : comAlfa(colors.primary, 0.14),
                borderColor: concluido
                  ? comAlfa(colors.success, 0.3)
                  : mensagemErro && !baixando
                    ? comAlfa(colors.error, 0.3)
                    : comAlfa(colors.primary, 0.3),
              },
            ]}
          >
            <Icone
              nome={concluido ? 'sucessoCirculo' : mensagemErro && !baixando ? 'erro' : 'download'}
              tamanho={18}
              cor={concluido ? colors.success : mensagemErro && !baixando ? colors.error : colors.primary}
            />
          </View>

          <View style={styles.cardTextos}>
            <Text style={[styles.cardTitulo, { color: colors.text }]} numberOfLines={2}>
              {estado.titulo ?? 'Download do Music Galaxy'}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.cardFormato, { color: colors.textSecondary }]}>
                Arquivo {formato}
              </Text>
              <View style={[styles.ponto, { backgroundColor: colors.glassBorder }]} />
              <Text style={[styles.cardFormato, { color: colors.textSecondary }]}>
                {concluido
                  ? `Concluído · ${formatarTamanho(estado.tamanhoTotal)}`
                  : baixando
                    ? `Baixando · ${percentual}%`
                    : mensagemErro
                      ? 'Interrompido'
                      : 'Aguardando'}
              </Text>
            </View>
          </View>
        </View>

        {/* Barra de progresso e detalhes */}
        {baixando && (
          <View style={styles.progressoBox}>
            <View style={[styles.barraFundo, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.barraPreenchida,
                  { backgroundColor: colors.primary, width: `${percentual}%` },
                ]}
              />
            </View>
            <View style={styles.progressoDetalhes}>
              <Text style={[styles.progressoPercentual, { color: colors.primary }]}>
                {percentual}%
              </Text>
              <Text style={[styles.progressoTamanho, { color: colors.textSecondary }]}>
                {formatarTamanho(estado.tamanhoAtual)} de {formatarTamanho(estado.tamanhoTotal)}
              </Text>
            </View>
          </View>
        )}

        {!!mensagemErro && !baixando && (
          <Text style={[styles.mensagemErro, { color: colors.error }]} numberOfLines={3}>
            {mensagemErro}
          </Text>
        )}

        {/* Ações */}
        <View style={styles.acoes}>
          {baixando ? (
            <TouchableOpacity
              style={[styles.botaoOutline, { borderColor: colors.glassBorder }]}
              onPress={() => void cancelarDownload(url)}
              activeOpacity={0.75}
            >
              <Icone nome="limpar" tamanho={13} cor={colors.textSecondary} />
              <Text style={[styles.botaoOutlineTexto, { color: colors.textSecondary }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          ) : mensagemErro ? (
            <TouchableOpacity
              style={[styles.botaoPrincipal, { backgroundColor: colors.button }]}
              onPress={() => void tentarNovamente(item)}
              activeOpacity={0.85}
            >
              <Icone nome="recarregar" tamanho={13} cor={colors.buttonText} />
              <Text style={[styles.botaoPrincipalTexto, { color: colors.buttonText }]}>
                Tentar novamente
              </Text>
            </TouchableOpacity>
          ) : null}

          {!baixando && (
            <TouchableOpacity
              style={[styles.botaoIcone, { borderColor: colors.glassBorder }]}
              onPress={() => removerDownload(url)}
              activeOpacity={0.75}
              accessibilityLabel="Remover download"
            >
              <Icone nome="lixeira" tamanho={14} cor={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    );
  };

  const vazio = (
    <View style={styles.vazio}>
      <View
        style={[
          styles.orbitaVazia,
          {
            backgroundColor: comAlfa(colors.luzSecundaria, 0.1),
            borderColor: colors.glassBorder,
          },
        ]}
      >
        <Image source={MASCOTE} style={styles.mascoteVazio} resizeMode="contain" />
      </View>
      <Text style={[styles.vazioTitulo, { color: colors.text }]}>
        {filtro === 'todos' ? 'Sua fila está vazia' : 'Nada por aqui'}
      </Text>
      <Text style={[styles.vazioDescricao, { color: colors.textSecondary }]}>
        {filtro === 'todos'
          ? 'Toque em “Baixar” em qualquer versão para acompanhar o progresso aqui.'
          : 'Nenhum download neste filtro no momento.'}
      </Text>
      <TouchableOpacity
        style={[styles.botaoPrincipal, { backgroundColor: colors.button, marginTop: 8 }]}
        onPress={() => navigation.navigate('Busca')}
        activeOpacity={0.85}
      >
        <Icone nome="busca" tamanho={14} cor={colors.buttonText} />
        <Text style={[styles.botaoPrincipalTexto, { color: colors.buttonText }]}>
          Encontrar músicas
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Cabeçalho */}
        <View style={styles.cabecalho}>
          <TouchableOpacity
            style={[styles.botaoVoltar, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            accessibilityLabel="Voltar"
          >
            <Icone nome="voltar" tamanho={18} cor={colors.text} />
          </TouchableOpacity>
          <View style={styles.cabecalhoTextos}>
            <Text style={[styles.titulo, { color: colors.text }]}>Downloads</Text>
            <Text style={[styles.subtitulo, { color: colors.textSecondary }]}>
              {contagem.total === 0
                ? 'Nenhum download ainda'
                : `${contagem.total} ${contagem.total === 1 ? 'arquivo' : 'arquivos'} na fila`}
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <View style={styles.filtros}>
          {filtros.map((opcao) => {
            const ativo = filtro === opcao.chave;
            return (
              <TouchableOpacity
                key={opcao.chave}
                style={[
                  styles.filtro,
                  {
                    backgroundColor: ativo ? colors.button : colors.glassCard,
                    borderColor: ativo ? colors.button : colors.glassBorder,
                  },
                ]}
                onPress={() => setFiltro(opcao.chave)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    { color: ativo ? colors.buttonText : colors.textSecondary },
                  ]}
                >
                  {opcao.rotulo}
                  {opcao.total > 0 ? ` ${opcao.total}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {carregando ? (
          <View style={styles.carregando}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.carregandoTexto, { color: colors.textSecondary }]}>
              Carregando a fila...
            </Text>
          </View>
        ) : (
          <FlatList
            data={itensFiltrados}
            keyExtractor={(item) => item.url}
            renderItem={renderItem}
            ListEmptyComponent={vazio}
            contentContainerStyle={[
              styles.lista,
              itensFiltrados.length === 0 && styles.listaVazia,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Limpeza em lote */}
        {itens.length > 0 && (
          <View style={styles.rodape}>
            {contagem.concluidos > 0 && (
              <TouchableOpacity
                style={[styles.botaoRodape, { borderColor: colors.glassBorder }]}
                onPress={limparConcluidos}
                activeOpacity={0.75}
              >
                <Icone nome="sucesso" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.botaoRodapeTexto, { color: colors.textSecondary }]}>
                  Limpar concluídos
                </Text>
              </TouchableOpacity>
            )}
            {contagem.erros > 0 && (
              <TouchableOpacity
                style={[styles.botaoRodape, { borderColor: colors.glassBorder }]}
                onPress={limparErros}
                activeOpacity={0.75}
              >
                <Icone nome="lixeira" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.botaoRodapeTexto, { color: colors.textSecondary }]}>
                  Limpar erros
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitulo: {
    fontSize: 12,
    marginTop: 2,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filtro: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filtroTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  lista: {
    paddingTop: 4,
    paddingBottom: 130,
  },
  listaVazia: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seloStatus: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextos: {
    flex: 1,
    gap: 3,
  },
  cardTitulo: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardFormato: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  ponto: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  progressoBox: {
    marginTop: 12,
  },
  barraFundo: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: 3,
  },
  progressoDetalhes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  progressoPercentual: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressoTamanho: {
    fontSize: 9,
  },
  mensagemErro: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  botaoPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  botaoPrincipalTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  botaoOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  botaoOutlineTexto: {
    fontSize: 10,
    fontWeight: '600',
  },
  botaoIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 32,
  },
  orbitaVazia: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  mascoteVazio: {
    width: 118,
    height: 118,
    borderRadius: 59,
  },
  vazioTitulo: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  vazioDescricao: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  rodape: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  botaoRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  botaoRodapeTexto: {
    fontSize: 10,
    fontWeight: '600',
  },
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  carregandoTexto: {
    fontSize: 12,
  },
});
