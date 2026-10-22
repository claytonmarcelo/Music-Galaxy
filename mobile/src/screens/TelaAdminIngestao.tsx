// Tela Administrativa de Ingestão.
// Permite forçar ingestão manual de termos a partir de fontes externas (MusicBrainz, Discogs).
// Endpoint: POST /api/search/ingest
// Segue a identidade visual de vidro fosco: fundo com luzes suaves e cartões translúcidos.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { forcarIngestao } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIngestao'>;

export default function TelaAdminIngestao({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { abrirErro, abrirAviso, toastSucesso } = useModal();
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Executa ingestão
  const handleForcarIngestao = async (): Promise<void> => {
    if (!termo.trim()) {
      abrirAviso('Termo vazio', 'Digite um termo para fazer a ingestão.');
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      setResultado(null);

      const resposta = await forcarIngestao(termo);

      if (resposta.success && resposta.data) {
        setResultado(resposta.data);
        toastSucesso('Ingestão concluída com sucesso!');
      } else {
        const mensagem = resposta.error || 'Erro na ingestão';
        setErro(mensagem);
        abrirErro('Falha na ingestão', mensagem);
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErro(mensagem);
      abrirErro('Falha na ingestão', mensagem);
    } finally {
      setCarregando(false);
    }
  };

  // Limpa formulário
  const handleLimpar = (): void => {
    setTermo('');
    setResultado(null);
    setErro(null);
  };

  return (
    <AuroraBackground style={styles.container}>
      {/* Cabeçalho em vidro forte */}
      <View
        style={[
          styles.headerBox,
          { backgroundColor: colors.glassCardForte, borderBottomColor: colors.glassBorder },
        ]}
      >
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.textoVoltar, { color: colors.primary }]}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={[styles.tituloHeader, { color: colors.text }]}>Admin: Ingestão</Text>
      </View>

      {/* Conteúdo */}
      <ScrollView style={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          <Text style={[styles.tituloSecao, { color: colors.primary }]}>⚙️ Forçar Ingestão Manual</Text>
          <Text style={[styles.descricao, { color: colors.textSecondary }]}>
            Use este painel para forçar a busca de um termo nas fontes externas (MusicBrainz, Discogs, Cover Art Archive) e sincronizar os dados com o banco local.
          </Text>
        </View>

        {/* Form de Ingestão */}
        <GlassCard style={[styles.card, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.labelInput, { color: colors.text }]}>Termo de Busca</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.input, borderColor: colors.glassBorder, color: colors.text },
            ]}
            placeholder="Ex: Daft Punk, One More Time"
            placeholderTextColor={colors.textSecondary}
            value={termo}
            onChangeText={setTermo}
            editable={!carregando}
          />

          {/* Botões */}
          <View style={styles.containerBotoes}>
            <TouchableOpacity
              style={[
                styles.botao,
                styles.botaoPrimario,
                { backgroundColor: colors.button },
                carregando && styles.botaoDisabilitado,
              ]}
              onPress={handleForcarIngestao}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={[styles.textoBotaoPrimario, { color: colors.buttonText }]}>
                  🔄 Iniciar Ingestão
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botao, styles.botaoSecundario, { borderColor: colors.primary }]}
              onPress={handleLimpar}
              disabled={carregando}
            >
              <Text style={[styles.textoBotaoSecundario, { color: colors.primary }]}>Limpar</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Resultado da Ingestão */}
        {resultado && (
          <GlassCard style={[styles.card, { borderLeftColor: colors.success }]}>
            <Text style={[styles.tituloResultado, { color: colors.success }]}>
              ✅ Resultado da Ingestão
            </Text>

            {resultado.works_created !== undefined && (
              <View style={[styles.itemResultado, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.labelResultado, { color: colors.textSecondary }]}>
                  Obras criadas:
                </Text>
                <Text style={[styles.valorResultado, { color: colors.success }]}>
                  {resultado.works_created}
                </Text>
              </View>
            )}

            {resultado.releases_created !== undefined && (
              <View style={[styles.itemResultado, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.labelResultado, { color: colors.textSecondary }]}>
                  Versões criadas:
                </Text>
                <Text style={[styles.valorResultado, { color: colors.success }]}>
                  {resultado.releases_created}
                </Text>
              </View>
            )}

            {resultado.metadata_source && (
              <View style={[styles.itemResultado, { borderBottomColor: colors.glassBorder }]}>
                <Text style={[styles.labelResultado, { color: colors.textSecondary }]}>
                  Fonte de Metadados:
                </Text>
                <Text style={[styles.valorResultado, { color: colors.success }]}>
                  {resultado.metadata_source}
                </Text>
              </View>
            )}

            {resultado.timestamp && (
              <View style={styles.itemResultado}>
                <Text style={[styles.labelResultado, { color: colors.textSecondary }]}>
                  Executado em:
                </Text>
                <Text style={[styles.valorResultado, { color: colors.success }]}>
                  {new Date(resultado.timestamp).toLocaleString('pt-BR')}
                </Text>
              </View>
            )}
          </GlassCard>
        )}

        {/* Erro */}
        {erro && (
          <GlassCard style={[styles.card, { borderLeftColor: colors.error }]}>
            <Text style={[styles.tituloErro, { color: colors.error }]}>❌ Erro</Text>
            <Text style={[styles.textoErro, { color: colors.textSecondary }]}>{erro}</Text>
          </GlassCard>
        )}

        {/* Informações */}
        <GlassCard style={[styles.card, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.tituloSecao, { color: colors.primary }]}>📝 Como Funciona</Text>
          <Text style={[styles.textoInfo, { color: colors.textSecondary }]}>
            Quando você realiza uma ingestão manual:
          </Text>

          <View style={styles.listaItems}>
            <View style={styles.itemLista}>
              <Text style={[styles.numeroBala, { color: colors.primary }]}>1</Text>
              <Text style={[styles.textoLista, { color: colors.textSecondary }]}>
                O termo é enviado para as APIs externas (MusicBrainz, Discogs)
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={[styles.numeroBala, { color: colors.primary }]}>2</Text>
              <Text style={[styles.textoLista, { color: colors.textSecondary }]}>
                Novas obras e versões são criadas/atualizadas no banco de dados
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={[styles.numeroBala, { color: colors.primary }]}>3</Text>
              <Text style={[styles.textoLista, { color: colors.textSecondary }]}>
                Capas oficiais são buscadas na Cover Art Archive
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={[styles.numeroBala, { color: colors.primary }]}>4</Text>
              <Text style={[styles.textoLista, { color: colors.textSecondary }]}>
                O cache é atualizado para próximas buscas serem mais rápidas
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Respeito a Rate Limiting */}
        <GlassCard style={[styles.card, { borderLeftColor: colors.warning }]}>
          <Text style={[styles.tituloAviso, { color: colors.warning }]}>
            ⚠️ Respeito a Rate Limiting
          </Text>
          <Text style={[styles.textoAviso, { color: colors.textSecondary }]}>
            • MusicBrainz: 1 requisição por segundo{'\n'}
            • Discogs: 60 requisições por minuto (autenticado){'\n'}
            • Ingestões são enfileiradas para respeitar estes limites
          </Text>
        </GlassCard>

        {/* Espaço extra */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ============================================================
// Estilos
// As cores vêm do tema (useTheme) e são aplicadas nos componentes;
// aqui ficam apenas os valores de layout.
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  botaoVoltar: {
    padding: 8,
  },

  textoVoltar: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  tituloHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 40,
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  secao: {
    marginBottom: 20,
  },

  tituloSecao: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  descricao: {
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },

  labelInput: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },

  containerBotoes: {
    flexDirection: 'row',
    gap: 12,
  },

  botao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoPrimario: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoSecundario: {
    borderWidth: 2,
  },

  botaoDisabilitado: {
    opacity: 0.5,
  },

  textoBotaoPrimario: {
    fontWeight: 'bold',
    fontSize: 13,
  },

  textoBotaoSecundario: {
    fontWeight: 'bold',
    fontSize: 13,
  },

  tituloResultado: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  itemResultado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },

  labelResultado: {
    fontSize: 13,
  },

  valorResultado: {
    fontSize: 13,
    fontWeight: 'bold',
  },

  tituloErro: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  textoErro: {
    fontSize: 13,
    lineHeight: 18,
  },

  textoInfo: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },

  listaItems: {
    marginTop: 12,
  },

  itemLista: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  numeroBala: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    minWidth: 20,
  },

  textoLista: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  tituloAviso: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  textoAviso: {
    fontSize: 12,
    lineHeight: 18,
  },
});
