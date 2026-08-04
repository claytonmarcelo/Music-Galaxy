// Tela Administrativa de Ingestão.
// Permite forçar ingestão manual de termos a partir de fontes externas (MusicBrainz, Discogs).
// Endpoint: POST /api/search/ingest

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { forcarIngestao } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIngestao'>;

export default function TelaAdminIngestao({ navigation }: Props): React.JSX.Element {
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Executa ingestão
  const handleForcarIngestao = async (): Promise<void> => {
    if (!termo.trim()) {
      Alert.alert('Erro', 'Digite um termo para fazer ingestão');
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      setResultado(null);

      const resposta = await forcarIngestao(termo);

      if (resposta.success && resposta.data) {
        setResultado(resposta.data);
        Alert.alert(
          'Sucesso',
          `Ingestão concluída!\n\nObras criadas: ${resposta.data.works_created || 0}\nReleases criados: ${resposta.data.releases_created || 0}`
        );
      } else {
        const mensagem = resposta.error || 'Erro na ingestão';
        setErro(mensagem);
        Alert.alert('Erro', mensagem);
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErro(mensagem);
      Alert.alert('Erro', mensagem);
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
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.headerBox}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.textoVoltar}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Admin: Ingestão</Text>
      </View>

      {/* Conteúdo */}
      <ScrollView style={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>⚙️ Forçar Ingestão Manual</Text>
          <Text style={styles.descricao}>
            Use este painel para forçar a busca de um termo nas fontes externas (MusicBrainz, Discogs, Cover Art Archive) e sincronizar os dados com o banco local.
          </Text>
        </View>

        {/* Form de Ingestão */}
        <View style={styles.card}>
          <Text style={styles.labelInput}>Termo de Busca</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Daft Punk, One More Time"
            placeholderTextColor="#666666"
            value={termo}
            onChangeText={setTermo}
            editable={!carregando}
          />

          {/* Botões */}
          <View style={styles.containerBotoes}>
            <TouchableOpacity
              style={[styles.botao, styles.botaoPrimario, carregando && styles.botaoDisabilitado]}
              onPress={handleForcarIngestao}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.textoBotaoPrimario}>🔄 Iniciar Ingestão</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botao, styles.botaoSecundario]}
              onPress={handleLimpar}
              disabled={carregando}
            >
              <Text style={styles.textoBotaoSecundario}>Limpar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resultado da Ingestão */}
        {resultado && (
          <View style={styles.card}>
            <Text style={styles.tituloResultado}>✅ Resultado da Ingestão</Text>

            {resultado.works_created !== undefined && (
              <View style={styles.itemResultado}>
                <Text style={styles.labelResultado}>Obras Criadas:</Text>
                <Text style={styles.valorResultado}>{resultado.works_created}</Text>
              </View>
            )}

            {resultado.releases_created !== undefined && (
              <View style={styles.itemResultado}>
                <Text style={styles.labelResultado}>Releases Criados:</Text>
                <Text style={styles.valorResultado}>{resultado.releases_created}</Text>
              </View>
            )}

            {resultado.metadata_source && (
              <View style={styles.itemResultado}>
                <Text style={styles.labelResultado}>Fonte de Metadados:</Text>
                <Text style={styles.valorResultado}>{resultado.metadata_source}</Text>
              </View>
            )}

            {resultado.timestamp && (
              <View style={styles.itemResultado}>
                <Text style={styles.labelResultado}>Executado em:</Text>
                <Text style={styles.valorResultado}>
                  {new Date(resultado.timestamp).toLocaleString('pt-BR')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Erro */}
        {erro && (
          <View style={styles.cardErro}>
            <Text style={styles.tituloErro}>❌ Erro</Text>
            <Text style={styles.textoErro}>{erro}</Text>
          </View>
        )}

        {/* Informações */}
        <View style={styles.card}>
          <Text style={styles.tituloSecao}>📝 Como Funciona</Text>
          <Text style={styles.textoInfo}>
            Quando você realiza uma ingestão manual:
          </Text>

          <View style={styles.listaItems}>
            <View style={styles.itemLista}>
              <Text style={styles.numeroBala}>1</Text>
              <Text style={styles.textoLista}>
                O termo é enviado para as APIs externas (MusicBrainz, Discogs)
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={styles.numeroBala}>2</Text>
              <Text style={styles.textoLista}>
                Novas obras e releases são criados/atualizados no banco de dados
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={styles.numeroBala}>3</Text>
              <Text style={styles.textoLista}>
                Capas oficiais são buscadas na Cover Art Archive
              </Text>
            </View>

            <View style={styles.itemLista}>
              <Text style={styles.numeroBala}>4</Text>
              <Text style={styles.textoLista}>
                Cache é atualizado para próximas buscas serem mais rápidas
              </Text>
            </View>
          </View>
        </View>

        {/* Respeito a Rate Limiting */}
        <View style={styles.cardAviso}>
          <Text style={styles.tituloAviso}>⚠️ Respeito a Rate Limiting</Text>
          <Text style={styles.textoAviso}>
            • MusicBrainz: 1 requisição por segundo{'\n'}
            • Discogs: 60 requisições por minuto (autenticado){'\n'}
            • Ingestões são enfileiradas para respeitar estes limites
          </Text>
        </View>

        {/* Espaço extra */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },

  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  botaoVoltar: {
    padding: 8,
  },

  textoVoltar: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
  },

  tituloHeader: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
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
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  descricao: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  labelInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#0F0F1A',
    borderWidth: 1,
    borderColor: '#2E2E4E',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
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
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoPrimario: {
    backgroundColor: '#FF6B35',
  },

  botaoSecundario: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },

  botaoDisabilitado: {
    opacity: 0.5,
  },

  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },

  textoBotaoSecundario: {
    color: '#FF6B35',
    fontWeight: 'bold',
    fontSize: 13,
  },

  tituloResultado: {
    color: '#00FF00',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  itemResultado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  labelResultado: {
    color: '#AAAAAA',
    fontSize: 13,
  },

  valorResultado: {
    color: '#00FF00',
    fontSize: 13,
    fontWeight: 'bold',
  },

  cardErro: {
    backgroundColor: '#FF6B3520',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  tituloErro: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  textoErro: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 18,
  },

  textoInfo: {
    color: '#AAAAAA',
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
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    minWidth: 20,
  },

  textoLista: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  cardAviso: {
    backgroundColor: '#FF6B3510',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  tituloAviso: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  textoAviso: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 18,
  },
});
