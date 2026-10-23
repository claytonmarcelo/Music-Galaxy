// Tela administrativa de ingestão manual.
// Força a sincronização de um termo nas fontes externas (MusicBrainz,
// Discogs e Cover Art Archive) e mostra o resumo da execução. É uma tela
// de manutenção, acessível fora do fluxo normal de busca do aplicativo.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, ResultadoIngestao } from '../types';
import { forcarIngestao } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIngestao'>;

// Etapas explicadas no cartão "Como funciona".
const ETAPAS = [
  'O termo é enviado às fontes externas (MusicBrainz e Discogs).',
  'Novas obras e versões são criadas ou atualizadas no banco local.',
  'As capas oficiais são buscadas na Cover Art Archive.',
  'O cache é atualizado para as próximas buscas serem mais rápidas.',
];

export default function TelaAdminIngestao({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { abrirErro, abrirAviso, toastSucesso } = useModal();
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoIngestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
        // Após uma ingestão bem-sucedida, o usuário volta à busca.
        navigation.navigate('Busca');
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

  const handleLimpar = (): void => {
    setTermo('');
    setResultado(null);
    setErro(null);
  };

  const linhaResultado = (
    label: string,
    valor: string | number | undefined,
    ultima = false
  ): React.JSX.Element | null => {
    if (valor === undefined || valor === null) return null;
    return (
      <View
        style={[
          styles.linhaResultado,
          !ultima && { borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
        ]}
      >
        <Text style={[styles.labelResultado, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.valorResultado, { color: colors.text }]}>{valor}</Text>
      </View>
    );
  };

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View
            style={[
              styles.botaoCirculo,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
          >
            <Icone nome="banco" tamanho={18} cor={colors.primary} />
          </View>

          <View style={styles.headerTextos}>
            <Text style={[styles.headerTitulo, { color: colors.text }]}>Administração</Text>
            <Text style={[styles.headerSubtitulo, { color: colors.textSecondary }]}>
              Ingestão manual de metadados
            </Text>
          </View>

          <CustomButton
            title="Voltar"
            variant="secondary"
            size="small"
            icone="voltar"
            onPress={() => navigation.goBack()}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
        >
          {/* Explicação */}
          <GlassCard style={styles.card}>
            <View style={styles.tituloLinha}>
              <View
                style={[
                  styles.iconeSelo,
                  { backgroundColor: comAlfa(colors.primary, 0.13), borderColor: comAlfa(colors.primary, 0.26) },
                ]}
              >
                <Icone nome="recarregar" tamanho={16} cor={colors.primary} />
              </View>
              <Text style={[styles.cardTitulo, { color: colors.text }]}>
                Forçar ingestão manual
              </Text>
            </View>
            <Text style={[styles.descricao, { color: colors.textSecondary }]}>
              Painel de manutenção: busca um termo nas fontes externas e sincroniza os
              metadados com o banco local. O fluxo normal do aplicativo já faz isso
              automaticamente em segundo plano.
            </Text>
          </GlassCard>

          {/* Formulário */}
          <GlassCard style={styles.card}>
            <Text style={[styles.labelInput, { color: colors.text }]}>Termo de busca</Text>
            <View
              style={[
                styles.campo,
                { backgroundColor: colors.input, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="busca" tamanho={16} cor={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Ex.: Daft Punk, One More Time"
                placeholderTextColor={colors.textSecondary}
                value={termo}
                onChangeText={setTermo}
                editable={!carregando}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Termo para ingestão manual"
              />
              {termo.length > 0 && !carregando && (
                <Text
                  style={[styles.limparCampo, { color: colors.textSecondary }]}
                  onPress={() => setTermo('')}
                  accessibilityLabel="Limpar termo"
                >
                  Limpar
                </Text>
              )}
            </View>

            <View style={styles.containerBotoes}>
              <View style={styles.botaoMetade}>
                <CustomButton
                  title="Iniciar ingestão"
                  icone="recarregar"
                  loading={carregando}
                  onPress={handleForcarIngestao}
                  style={styles.botaoCheio}
                />
              </View>
              <View style={styles.botaoMetade}>
                <CustomButton
                  title="Limpar"
                  variant="secondary"
                  icone="limpar"
                  disabled={carregando}
                  onPress={handleLimpar}
                  style={styles.botaoCheio}
                />
              </View>
            </View>
          </GlassCard>

          {/* Resultado */}
          {resultado && (
            <GlassCard style={styles.card}>
              <View style={styles.tituloLinha}>
                <View
                  style={[
                    styles.iconeSelo,
                    { backgroundColor: comAlfa(colors.success, 0.13), borderColor: comAlfa(colors.success, 0.28) },
                  ]}
                >
                  <Icone nome="sucessoCirculo" tamanho={16} cor={colors.success} />
                </View>
                <Text style={[styles.cardTitulo, { color: colors.success }]}>
                  Ingestão concluída
                </Text>
              </View>

              {linhaResultado('Obras criadas', resultado.works_created)}
              {linhaResultado('Versões criadas', resultado.releases_created)}
              {linhaResultado('Fonte dos metadados', resultado.metadata_source)}
              {linhaResultado(
                'Executado em',
                resultado.timestamp ? new Date(resultado.timestamp).toLocaleString('pt-BR') : undefined,
                true
              )}
            </GlassCard>
          )}

          {/* Erro */}
          {erro && (
            <GlassCard style={styles.card}>
              <View style={styles.tituloLinha}>
                <View
                  style={[
                    styles.iconeSelo,
                    { backgroundColor: comAlfa(colors.error, 0.13), borderColor: comAlfa(colors.error, 0.28) },
                  ]}
                >
                  <Icone nome="erro" tamanho={16} cor={colors.error} />
                </View>
                <Text style={[styles.cardTitulo, { color: colors.error }]}>
                  Falha na ingestão
                </Text>
              </View>
              <Text style={[styles.textoErro, { color: colors.textSecondary }]}>{erro}</Text>
            </GlassCard>
          )}

          {/* Como funciona */}
          <GlassCard style={styles.card}>
            <View style={styles.tituloLinha}>
              <View
                style={[
                  styles.iconeSelo,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
              >
                <Icone nome="info" tamanho={16} cor={colors.textSecondary} />
              </View>
              <Text style={[styles.cardTitulo, { color: colors.text }]}>Como funciona</Text>
            </View>

            {ETAPAS.map((etapa, indice) => (
              <View key={etapa} style={styles.etapa}>
                <View
                  style={[
                    styles.numero,
                    { backgroundColor: comAlfa(colors.primary, 0.14), borderColor: comAlfa(colors.primary, 0.3) },
                  ]}
                >
                  <Text style={[styles.numeroTexto, { color: colors.primary }]}>
                    {indice + 1}
                  </Text>
                </View>
                <Text style={[styles.textoLista, { color: colors.textSecondary }]}>
                  {etapa}
                </Text>
              </View>
            ))}
          </GlassCard>

          {/* Limites das fontes */}
          <GlassCard style={styles.card}>
            <View style={styles.tituloLinha}>
              <View
                style={[
                  styles.iconeSelo,
                  { backgroundColor: comAlfa(colors.warning, 0.13), borderColor: comAlfa(colors.warning, 0.28) },
                ]}
              >
                <Icone nome="aviso" tamanho={16} cor={colors.warning} />
              </View>
              <Text style={[styles.cardTitulo, { color: colors.text }]}>
                Limites das fontes
              </Text>
            </View>

            <LinhaAviso icone="relogio" texto="MusicBrainz: 1 requisição por segundo" />
            <LinhaAviso icone="escudo" texto="Discogs: 60 requisições por minuto (autenticado)" />
            <LinhaAviso icone="fila" texto="Ingestões são enfileiradas para respeitar os limites" />
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

// Linha de aviso com ícone, usada no cartão de limites.
function LinhaAviso({ icone, texto }: { icone: NomeIcone; texto: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.linhaAviso}>
      <Icone nome={icone} tamanho={13} cor={colors.textSecondary} />
      <Text style={[styles.textoAviso, { color: colors.textSecondary }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 18 : 4,
    paddingBottom: 10,
  },
  botaoCirculo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextos: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitulo: {
    fontSize: 10.5,
    marginTop: 2,
  },
  conteudo: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 24,
  },
  tituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconeSelo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitulo: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  descricao: {
    fontSize: 12,
    lineHeight: 18,
  },
  labelInput: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    minHeight: 48,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 12.5,
    paddingVertical: 0,
  },
  limparCampo: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  containerBotoes: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoMetade: {
    flex: 1,
  },
  botaoCheio: {
    width: '100%',
  },
  linhaResultado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  labelResultado: {
    fontSize: 12,
  },
  valorResultado: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  textoErro: {
    fontSize: 12,
    lineHeight: 18,
  },
  etapa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 11,
  },
  numero: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  textoLista: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    paddingTop: 3,
  },
  linhaAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  textoAviso: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
  },
});
