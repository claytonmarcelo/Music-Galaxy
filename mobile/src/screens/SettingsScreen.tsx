// Tela de Configurações
// Permite mudar o tema, gerenciar downloads, definir o endereço do servidor
// da API e ver informações do aplicativo.
// Segue a identidade visual de vidro fosco: fundo com luzes suaves e cartões translúcidos.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { MusicEmojis } from '../components/AnimatedIcon';
import { downloadManager } from '../services/downloadManager';
import {
  BASE_URL,
  configurarServidor,
  restaurarServidorPadrao,
  testarConexaoServidor,
} from '../services/api';
import CustomButton from '../components/CustomButton';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

export default function SettingsScreen(): React.JSX.Element {
  const { theme, isDark, colors, setTheme } = useTheme();
  const { abrirErro, abrirAviso, toastSucesso, toastInfo } = useModal();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    downloading: 0,
    completed: 0,
    error: 0,
    totalSize: 0,
  });

  // Endereço do servidor exibido no campo — começa com o valor atual da API.
  const [urlServidor, setUrlServidor] = useState(BASE_URL);
  // Estados de carregamento dos botões da seção Servidor da API.
  const [salvandoServidor, setSalvandoServidor] = useState(false);
  const [testandoServidor, setTestandoServidor] = useState(false);

  useEffect(() => {
    downloadManager.initialize();
    loadStats();
  }, []);

  const loadStats = () => {
    const currentStats = downloadManager.getStats();
    setStats(currentStats);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
  };

  const clearCompleted = async () => {
    await downloadManager.clearCompleted();
    loadStats();
  };

  const clearErrors = async () => {
    await downloadManager.clearErrors();
    loadStats();
  };

  // Salva o endereço informado e aplica nas próximas chamadas da API.
  const handleSalvarServidor = async () => {
    try {
      setSalvandoServidor(true);
      const normalizado = await configurarServidor(urlServidor);
      setUrlServidor(normalizado);
      toastSucesso('Servidor salvo!');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao salvar o servidor.';
      abrirErro('Não foi possível salvar', mensagem);
    } finally {
      setSalvandoServidor(false);
    }
  };

  // Testa se o endereço informado responde no endpoint de saúde.
  const handleTestarConexao = async () => {
    try {
      setTestandoServidor(true);
      const ok = await testarConexaoServidor(urlServidor);
      if (ok) {
        toastSucesso('Conexão bem-sucedida!');
      } else {
        abrirAviso(
          'Falha na conexão',
          'Não foi possível alcançar o servidor. Verifique o endereço e se o servidor está no ar.'
        );
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao testar a conexão.';
      abrirErro('Não foi possível testar a conexão', mensagem);
    } finally {
      setTestandoServidor(false);
    }
  };

  // Volta ao endereço padrão do ambiente.
  const handleRestaurarPadrao = async () => {
    try {
      const padrao = await restaurarServidorPadrao();
      setUrlServidor(padrao);
      toastInfo('Endereço padrão restaurado.');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao restaurar o padrão.';
      abrirErro('Não foi possível restaurar', mensagem);
    }
  };

  // Estilo reutilizável das linhas de opção (borda com token do tema).
  const estiloOpcao = [styles.option, { borderBottomColor: colors.border }];

  return (
    <AuroraBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView style={styles.scrollView}>
          {/* Seção de Tema */}
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {MusicEmojis.settings} Aparência
            </Text>

            <View style={estiloOpcao}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Tema</Text>
              <View style={styles.themeButtons}>
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    { borderColor: colors.border },
                    theme === 'light' && { backgroundColor: colors.button },
                  ]}
                  onPress={() => handleThemeChange('light')}
                >
                  <Text style={[
                    styles.themeButtonText,
                    { color: theme === 'light' ? colors.buttonText : colors.text }
                  ]}>
                    {MusicEmojis.sun} Claro
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    { borderColor: colors.border },
                    theme === 'dark' && { backgroundColor: colors.button },
                  ]}
                  onPress={() => handleThemeChange('dark')}
                >
                  <Text style={[
                    styles.themeButtonText,
                    { color: theme === 'dark' ? colors.buttonText : colors.text }
                  ]}>
                    {MusicEmojis.moon} Escuro
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    { borderColor: colors.border },
                    theme === 'auto' && { backgroundColor: colors.button },
                  ]}
                  onPress={() => handleThemeChange('auto')}
                >
                  <Text style={[
                    styles.themeButtonText,
                    { color: theme === 'auto' ? colors.buttonText : colors.text }
                  ]}>
                    {MusicEmojis.auto} Auto
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={estiloOpcao}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Tema atual</Text>
              <Text style={[styles.optionValue, { color: colors.textSecondary }]}>
                {theme === 'auto' ? (isDark ? 'Escuro (sistema)' : 'Claro (sistema)') : (theme === 'dark' ? 'Escuro' : 'Claro')}
              </Text>
            </View>
          </GlassCard>

          {/* Seção de Downloads */}
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {MusicEmojis.download} Downloads
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.button }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success }]}>{stats.completed}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Concluídos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendentes</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.error }]}>{stats.error}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Erros</Text>
              </View>
            </View>

            <CustomButton
              title="Limpar Concluídos"
              onPress={clearCompleted}
              variant="outline"
              size="small"
              icon={MusicEmojis.success}
            />

            <CustomButton
              title="Limpar Erros"
              onPress={clearErrors}
              variant="outline"
              size="small"
              icon={MusicEmojis.error}
            />
          </GlassCard>

          {/* Seção do Servidor da API */}
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {MusicEmojis.explore} Servidor da API
            </Text>

            <Text style={[styles.serverDesc, { color: colors.textSecondary }]}>
              Endereço do servidor que fornece as músicas. Em redes diferentes, ajuste aqui para o aplicativo funcionar.
            </Text>

            <TextInput
              style={[
                styles.serverInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.glassBorder,
                  color: colors.text,
                },
              ]}
              value={urlServidor}
              onChangeText={setUrlServidor}
              placeholder={urlServidor ? undefined : 'http://exemplo.com:3001'}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.serverBotoesLinha}>
              <View style={styles.serverBotao}>
                <CustomButton
                  title="Salvar"
                  onPress={handleSalvarServidor}
                  variant="primary"
                  size="small"
                  icon={MusicEmojis.success}
                  loading={salvandoServidor}
                />
              </View>
              <View style={styles.serverBotao}>
                <CustomButton
                  title="Testar conexão"
                  onPress={handleTestarConexao}
                  variant="outline"
                  size="small"
                  icon={MusicEmojis.search}
                  loading={testandoServidor}
                />
              </View>
            </View>

            <CustomButton
              title="Restaurar padrão"
              onPress={handleRestaurarPadrao}
              variant="ghost"
              size="small"
              icon={MusicEmojis.auto}
            />
          </GlassCard>

          {/* Seção de Informações */}
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {MusicEmojis.info} Sobre
            </Text>

            <View style={estiloOpcao}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Versão</Text>
              <Text style={[styles.optionValue, { color: colors.textSecondary }]}>1.0.0</Text>
            </View>

            <View style={estiloOpcao}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Nome</Text>
              <Text style={[styles.optionValue, { color: colors.textSecondary }]}>Music Galaxy</Text>
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionValue: {
    fontSize: 14,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  serverDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  serverInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  serverBotoesLinha: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  serverBotao: {
    flex: 1,
  },
});
