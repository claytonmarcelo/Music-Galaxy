// Tela de Favoritos — todas as versões marcadas com coração.
// A lista usa o mesmo card de versão da busca, com player e download
// disponíveis; o estado vazio convida a voltar para a busca.

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import ReleaseCard from '../components/ReleaseCard';
import FundoAtmosfera from '../components/FundoAtmosfera';
import Icone from '../components/Icone';
import CustomButton from '../components/CustomButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Favoritos'>;

const MASCOTE = require('../../assets/mascote.png');

export default function FavoritosScreen({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { abrirConfirmacao } = useModal();
  const { colors } = useTheme();

  const handleRemoverFavorito = (releaseId: number): void => {
    abrirConfirmacao(
      'Remover dos favoritos?',
      'Deseja remover esta versão dos seus favoritos?',
      () => removerFavorito(releaseId)
    );
  };

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.cabecalho}>
          <TouchableOpacity
            style={[
              styles.botaoCirculo,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            accessibilityLabel="Voltar"
          >
            <Icone nome="voltar" tamanho={19} cor={colors.text} />
          </TouchableOpacity>

          <View style={styles.cabecalhoTextos}>
            <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>SUA SELEÇÃO</Text>
            <Text style={[styles.titulo, { color: colors.text }]}>Favoritos</Text>
          </View>

          <View
            style={[
              styles.contador,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
          >
            <Icone nome="favoritoCheio" tamanho={14} cor={colors.primary} />
            <Text style={[styles.contadorTexto, { color: colors.text }]}>
              {favoritos.length}
            </Text>
          </View>
        </View>

        {favoritos.length > 0 ? (
          <FlatList
            data={favoritos}
            keyExtractor={(rel) => `fav-${rel.id}`}
            renderItem={({ item }) => (
              <View>
                <ReleaseCard
                  release={item}
                  onPress={() => navigation.push('DetalheRelease', { release: item })}
                />
                <TouchableOpacity
                  style={styles.removerLinha}
                  onPress={() => handleRemoverFavorito(item.id)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Remover ${item.version_name} dos favoritos`}
                >
                  <Icone nome="lixeira" tamanho={11} cor={colors.textSecondary} />
                  <Text style={[styles.removerTexto, { color: colors.textSecondary }]}>
                    Remover dos favoritos
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.listaConteudo}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.viewVazio}>
            <View
              style={[
                styles.mascoteMoldura,
                { backgroundColor: colors.glassCardForte, borderColor: colors.glassBorder },
              ]}
            >
              <Image
                source={MASCOTE}
                style={styles.mascote}
                resizeMode="cover"
                accessibilityLabel="Mascote do Music Galaxy"
              />
            </View>

            <Text style={[styles.textoVazio, { color: colors.text }]}>
              Nenhum favorito ainda
            </Text>
            <Text style={[styles.descricaoVazia, { color: colors.textSecondary }]}>
              Toque no coração de uma versão para guardá-la aqui e encontrá-la rapidinho.
            </Text>

            <CustomButton
              title="Começar a buscar"
              icone="busca"
              onPress={() => navigation.navigate('Busca')}
            />
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 18 : 4,
    paddingBottom: 10,
  },
  cabecalhoTextos: {
    flex: 1,
  },
  etiqueta: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  botaoCirculo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
  },
  contadorTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  listaConteudo: {
    paddingTop: 6,
    paddingBottom: 130,
  },
  removerLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    marginRight: 22,
    marginTop: -4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removerTexto: {
    fontSize: 9.5,
    fontWeight: '500',
  },
  viewVazio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingBottom: 110,
  },
  mascoteMoldura: {
    width: 132,
    height: 132,
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  textoVazio: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  descricaoVazia: {
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 19,
    maxWidth: 300,
  },
});
