// Tela de compatibilidade do aparelho.
//
// Aparece quando o Android do aparelho é anterior à versão exigida pelo
// Music Galaxy (Android 16, de 2025, em diante). Em vez de deixar o
// aplicativo quebrar com um erro genérico, esta tela explica a situação com
// a versão exata do aparelho e oferece o caminho para resolver: atualizar o
// Android ou buscar pelo navegador a versão mais nova do aplicativo.

import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useVerificacaoAtualizacao } from '../hooks/useVerificacaoAtualizacao';
import {
  ANDROID_MINIMO_ROTULO,
  descricaoIncompatibilidade,
  nivelApiAndroid,
} from '../services/compatibilidade';
import CustomButton from '../components/CustomButton';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone from '../components/Icone';
import { comAlfa } from '../utils/cores';

// Mascote do Music Galaxy, exibido no aviso de aparelho desatualizado.
const MASCOTE = require('../../assets/mascote.png');

export default function TelaCompatibilidade(): React.JSX.Element {
  const { colors } = useTheme();
  const { verificando, consultar } = useVerificacaoAtualizacao();

  // Nível de API detectado no aparelho (36 = Android 16).
  const nivel = nivelApiAndroid() ?? 0;

  // Abre a página de informações do aplicativo no Android.
  const abrirInformacoes = () => {
    void Linking.openSettings();
  };

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mascoteMoldura}>
            <Image
              source={MASCOTE}
              style={styles.mascote}
              resizeMode="cover"
              accessibilityLabel="Mascote do Music Galaxy"
            />
          </View>

          <View style={[styles.selo, { backgroundColor: comAlfa(colors.warning, 0.14) }]}>
            <Icone nome="aviso" tamanho={14} cor={colors.warning} />
            <Text style={[styles.seloTexto, { color: colors.warning }]}>
              VERSÃO DO ANDROID
            </Text>
          </View>

          <Text style={[styles.titulo, { color: colors.text }]}>
            Atualize o Android do aparelho
          </Text>

          <Text style={[styles.texto, { color: colors.textSecondary }]}>
            {descricaoIncompatibilidade(nivel)}
          </Text>

          <GlassCard style={styles.cartao}>
            <Text style={[styles.cartaoTitulo, { color: colors.text }]}>
              Como resolver em três passos
            </Text>

            {[
              'Abra as Configurações do aparelho.',
              'Toque em Sistema e depois em Atualização do sistema (em alguns aparelhos, "Atualizar sistema").',
              'Deixe a atualização terminar e abra o Music Galaxy de novo.',
            ].map((passo, indice) => (
              <View key={passo} style={styles.passoLinha}>
                <View
                  style={[styles.passoNumero, { backgroundColor: comAlfa(colors.primary, 0.16) }]}
                >
                  <Text style={[styles.passoNumeroTexto, { color: colors.primary }]}>
                    {indice + 1}
                  </Text>
                </View>
                <Text style={[styles.passoTexto, { color: colors.textSecondary }]}>{passo}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard style={styles.cartao}>
            <Text style={[styles.cartaoTitulo, { color: colors.text }]}>
              Enquanto isso, você pode baixar a versão mais nova
            </Text>
            <Text style={[styles.cartaoTexto, { color: colors.textSecondary }]}>
              O aplicativo procura sozinho uma versão nova pela internet. Toque no botão abaixo
              para fazer a busca agora e abrir a página de download no navegador do aparelho.
            </Text>

            <CustomButton
              title="Procurar versão mais nova"
              onPress={() => void consultar(true)}
              variant="primary"
              size="medium"
              icone="recarregar"
              loading={verificando}
              style={styles.botao}
            />

            <CustomButton
              title="Abrir as informações do aplicativo"
              onPress={abrirInformacoes}
              variant="secondary"
              size="medium"
              icone="info"
              style={styles.botao}
            />
          </GlassCard>

          <Text style={[styles.rodape, { color: colors.textSecondary }]}>
            O Music Galaxy é distribuído apenas para {ANDROID_MINIMO_ROTULO} ou mais novo.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    alignItems: 'center',
  },
  mascoteMoldura: {
    width: 116,
    height: 116,
    borderRadius: 38,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  seloTexto: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  titulo: {
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  texto: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  cartao: {
    width: '100%',
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
  },
  cartaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cartaoTexto: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  passoLinha: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  passoNumero: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  passoNumeroTexto: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  passoTexto: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
  },
  botao: {
    width: '100%',
    marginBottom: 8,
  },
  rodape: {
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 4,
  },
});
