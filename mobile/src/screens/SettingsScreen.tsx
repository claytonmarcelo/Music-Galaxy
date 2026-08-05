// Tela de Configurações
// Permite mudar o tema, gerenciar downloads e outras configurações

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from '../components/AnimatedIcon';
import { downloadManager } from '../services/downloadManager';
import CustomButton from '../components/CustomButton';

export default function SettingsScreen(): React.JSX.Element {
  const { theme, isDark, colors, setTheme, toggleTheme } = useTheme();
  const [stats, setStats] = React.useState({
    total: 0,
    pending: 0,
    downloading: 0,
    completed: 0,
    error: 0,
    totalSize: 0,
  });

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Seção de Tema */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {MusicEmojis.settings} Aparência
          </Text>

          <View style={styles.option}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Tema</Text>
            <View style={styles.themeButtons}>
              <TouchableOpacity
                style={[
                  styles.themeButton,
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

          <View style={styles.option}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Tema atual</Text>
            <Text style={[styles.optionValue, { color: colors.textSecondary }]}>
              {theme === 'auto' ? (isDark ? 'Escuro (sistema)' : 'Claro (sistema)') : (theme === 'dark' ? 'Escuro' : 'Claro')}
            </Text>
          </View>
        </View>

        {/* Seção de Downloads */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
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
        </View>

        {/* Seção de Informações */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {MusicEmojis.info} Sobre
          </Text>

          <View style={styles.option}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Versão</Text>
            <Text style={[styles.optionValue, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>

          <View style={styles.option}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Nome</Text>
            <Text style={[styles.optionValue, { color: colors.textSecondary }]}>Music Galaxy</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
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
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
    borderColor: 'rgba(0, 0, 0, 0.2)',
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
});
