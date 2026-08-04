// Tela de Configurações.
// Gerencia tema, idioma, notificações e informações sobre o app.

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { useTema } from '../contexts/TemaContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const VERSAO_APP = '1.0.0';
const DATA_VERSAO = 'Agosto 2026';

export default function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const { tema, alternarTema } = useTema();
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  const [idiomaSelecionado, setIdiomaSelecionado] = useState('pt-BR');

  // Alterna notificações
  const handleAlternarNotificacoes = (): void => {
    setNotificacoesAtivas(!notificacoesAtivas);
    Alert.alert(
      'Notificações',
      notificacoesAtivas
        ? 'Notificações desativadas'
        : 'Notificações ativadas'
    );
  };

  // Alterna tema
  const handleAlternarTema = async (): Promise<void> => {
    await alternarTema();
  };

  // Muda idioma
  const handleMudarIdioma = (novoIdioma: string): void => {
    setIdiomaSelecionado(novoIdioma);
    Alert.alert('Idioma', `Idioma alterado para ${novoIdioma === 'pt-BR' ? 'Português' : 'English'}`);
  };

  // Abre link externo
  const handleAbrirLink = async (url: string): Promise<void> => {
    try {
      const pode = await Linking.canOpenURL(url);
      if (pode) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir este link');
      }
    } catch (err) {
      Alert.alert('Erro', 'Erro ao abrir link');
    }
  };

  // Renderiza item de configuração com switch
  const renderConfigSwitch = (
    label: string,
    valor: boolean,
    onToggle: () => void,
    descricao?: string
  ): React.JSX.Element => (
    <View style={styles.itemConfig}>
      <View style={styles.conteudoItem}>
        <Text style={styles.labelConfig}>{label}</Text>
        {descricao && (
          <Text style={styles.descricaoConfig}>{descricao}</Text>
        )}
      </View>
      <Switch
        value={valor}
        onValueChange={onToggle}
        trackColor={{ false: '#2E2E4E', true: '#FF6B35' }}
        thumbColor={valor ? '#FFFFFF' : '#AAAAAA'}
      />
    </View>
  );

  // Renderiza item de configuração com selector
  const renderConfigSelector = (
    label: string,
    opcoes: Array<{ label: string; valor: string }>,
    valorAtual: string,
    onSelecionar: (valor: string) => void,
    descricao?: string
  ): React.JSX.Element => (
    <View style={styles.secaoConfig}>
      <Text style={styles.labelConfig}>{label}</Text>
      {descricao && (
        <Text style={styles.descricaoConfig}>{descricao}</Text>
      )}
      <View style={styles.selectorOpcoes}>
        {opcoes.map(opcao => (
          <TouchableOpacity
            key={opcao.valor}
            style={[
              styles.opcao,
              valorAtual === opcao.valor && styles.opcaoSelecionada,
            ]}
            onPress={() => onSelecionar(opcao.valor)}
          >
            <Text
              style={[
                styles.textoOpcao,
                valorAtual === opcao.valor && styles.textoOpcaoSelecionada,
              ]}
            >
              {opcao.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Renderiza item de link
  const renderLinkItem = (
    titulo: string,
    descricao: string,
    url: string
  ): React.JSX.Element => (
    <TouchableOpacity
      style={styles.itemConfig}
      onPress={() => handleAbrirLink(url)}
      activeOpacity={0.7}
    >
      <View style={styles.conteudoItem}>
        <Text style={styles.labelConfig}>{titulo}</Text>
        <Text style={styles.descricaoConfig}>{descricao}</Text>
      </View>
      <Text style={styles.seta}>→</Text>
    </TouchableOpacity>
  );

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
        <Text style={styles.tituloHeader}>Configurações</Text>
      </View>

      {/* Conteúdo */}
      <ScrollView style={styles.conteudo}>
        {/* Seção: Tema */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>🎨 Aparência</Text>
          {renderConfigSelector(
            'Tema',
            [
              { label: '🌙 Escuro', valor: 'dark' },
              { label: '☀️ Claro', valor: 'light' },
            ],
            tema,
            async (valor) => {
              if (valor !== tema) {
                await alternarTema();
              }
            },
            'Escolha entre tema claro e escuro'
          )}
        </View>

        {/* Seção: Idioma */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>🌐 Idioma</Text>
          {renderConfigSelector(
            'Idioma do App',
            [
              { label: '🇧🇷 Português (BR)', valor: 'pt-BR' },
              { label: '🇺🇸 English (US)', valor: 'en-US' },
            ],
            idiomaSelecionado,
            handleMudarIdioma,
            'Selecione o idioma do aplicativo'
          )}
        </View>

        {/* Seção: Notificações */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>🔔 Notificações</Text>
          {renderConfigSwitch(
            'Ativar Notificações',
            notificacoesAtivas,
            handleAlternarNotificacoes,
            'Receba atualizações sobre novas versões'
          )}
        </View>

        {/* Seção: Sobre */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>ℹ️ Sobre</Text>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Music Galaxy</Text>
            <Text style={styles.valorInfo}>v{VERSAO_APP} ({DATA_VERSAO})</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Stack Tecnológica</Text>
            <Text style={styles.valorInfo}>React Native + TypeScript + Node.js</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Banco de Dados</Text>
            <Text style={styles.valorInfo}>MariaDB (Porta 3307)</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Fontes de Dados</Text>
            <Text style={styles.valorInfo}>MusicBrainz • Discogs • Cover Art Archive</Text>
          </View>
        </View>

        {/* Seção: Links Úteis */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>🔗 Links Úteis</Text>

          {renderLinkItem(
            'MusicBrainz',
            'Banco de dados aberto de metadados musicais',
            'https://musicbrainz.org'
          )}

          {renderLinkItem(
            'Discogs',
            'Catálogo de música e formatos físicos',
            'https://www.discogs.com'
          )}

          {renderLinkItem(
            'Cover Art Archive',
            'Capas oficiais de lançamentos musicais',
            'https://coverartarchive.org'
          )}
        </View>

        {/* Seção: Desenvolvedor */}
        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>👨‍💻 Desenvolvedor</Text>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Desenvolvido com ❤️</Text>
            <Text style={styles.valorInfo}>Music Galaxy Project 2026</Text>
          </View>

          <View style={styles.itemInfo}>
            <Text style={styles.labelInfo}>Licença</Text>
            <Text style={styles.valorInfo}>Propriedade Exclusiva</Text>
          </View>
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
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  tituloSecao: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  itemConfig: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  conteudoItem: {
    flex: 1,
  },

  labelConfig: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  descricaoConfig: {
    color: '#AAAAAA',
    fontSize: 12,
  },

  secaoConfig: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  selectorOpcoes: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between',
  },

  opcao: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    borderRadius: 6,
    paddingVertical: 10,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E2E4E',
  },

  opcaoSelecionada: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },

  textoOpcao: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  textoOpcaoSelecionada: {
    color: '#FFFFFF',
  },

  itemInfo: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  labelInfo: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  valorInfo: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 18,
  },

  seta: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
