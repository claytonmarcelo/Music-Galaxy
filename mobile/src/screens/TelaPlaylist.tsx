// Tela de uma playlist local.
// Mostra as versões na ordem em que foram adicionadas, permite renomear,
// remover versões e excluir a playlist. Nenhuma dessas ações apaga os
// arquivos baixados nem os favoritos — a playlist é só uma organização.

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release } from '../types';
import { usePlaylists } from '../contexts/PlaylistsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone from '../components/Icone';
import { traduzirTipoRelease } from '../utils/tiposRelease';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalhePlaylist'>;

export default function TelaPlaylist({ navigation, route }: Props): React.JSX.Element {
  const { playlistId } = route.params;
  const { colors } = useTheme();
  const {
    playlists,
    carregando,
    renomearPlaylist,
    excluirPlaylist,
    removerRelease,
  } = usePlaylists();
  const { abrirConfirmacao, toastSucesso, toastErro } = useModal();

  const playlist = playlists.find((item) => item.id === playlistId);

  const [renomeando, setRenomeando] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  const abrirRenomeacao = (): void => {
    if (!playlist) return;
    setNomeEdicao(playlist.nome);
    setRenomeando(true);
  };

  const salvarNome = async (): Promise<void> => {
    if (!playlist || salvandoNome) return;
    setSalvandoNome(true);

    try {
      await renomearPlaylist(playlist.id, nomeEdicao);
      setRenomeando(false);
      toastSucesso('Playlist renomeada.');
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível renomear a playlist.';
      toastErro(mensagem);
    } finally {
      setSalvandoNome(false);
    }
  };

  const confirmarExclusao = (): void => {
    if (!playlist) return;

    abrirConfirmacao(
      'Excluir playlist?',
      `“${playlist.nome}” será removida do aparelho. As versões continuam nos favoritos e nenhum arquivo baixado será apagado.`,
      () => {
        void (async () => {
          try {
            await excluirPlaylist(playlist.id);
            toastSucesso('Playlist excluída.');
            navigation.goBack();
          } catch (erro) {
            const mensagem =
              erro instanceof Error ? erro.message : 'Não foi possível excluir a playlist.';
            toastErro(mensagem);
          }
        })();
      }
    );
  };

  const confirmarRemocao = (release: Release): void => {
    if (!playlist) return;

    abrirConfirmacao(
      'Remover da playlist?',
      `“${release.version_name}” sairá desta playlist. A versão continua nos favoritos e o arquivo baixado não é apagado.`,
      () => {
        void (async () => {
          try {
            await removerRelease(playlist.id, release.id);
            toastSucesso('Versão removida da playlist.');
          } catch (erro) {
            const mensagem =
              erro instanceof Error ? erro.message : 'Não foi possível remover a versão.';
            toastErro(mensagem);
          }
        })();
      }
    );
  };

  // Cabeçalho reutilizado tanto no estado normal quanto no de playlist ausente.
  const cabecalho = (
    <View style={styles.cabecalho}>
      <TouchableOpacity
        style={[
          styles.botaoCirculo,
          { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        ]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Icone nome="voltar" tamanho={19} cor={colors.text} />
      </TouchableOpacity>

      <View style={styles.cabecalhoTextos}>
        <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>SUA PLAYLIST</Text>
        <Text style={[styles.tituloTela, { color: colors.text }]} numberOfLines={1}>
          {playlist?.nome ?? 'Playlist'}
        </Text>
      </View>

      {playlist && (
        <>
          <TouchableOpacity
            style={[
              styles.botaoCirculo,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
            onPress={abrirRenomeacao}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Renomear playlist"
          >
            <Icone nome="lapis" tamanho={17} cor={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.botaoCirculo,
              {
                backgroundColor: comAlfa(colors.error, 0.12),
                borderColor: comAlfa(colors.error, 0.3),
              },
            ]}
            onPress={confirmarExclusao}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Excluir playlist"
          >
            <Icone nome="lixeira" tamanho={17} cor={colors.error} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (carregando) {
    return (
      <FundoAtmosfera>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          {cabecalho}
          <View style={styles.carregando}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.carregandoTexto, { color: colors.textSecondary }]}>
              Carregando a playlist...
            </Text>
          </View>
        </SafeAreaView>
      </FundoAtmosfera>
    );
  }

  if (!playlist) {
    return (
      <FundoAtmosfera>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          {cabecalho}
          <View style={styles.ausente}>
            <View
              style={[
                styles.ausenteIcone,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="playlist" tamanho={26} cor={colors.textSecondary} />
            </View>
            <Text style={[styles.ausenteTitulo, { color: colors.text }]}>
              Playlist não encontrada
            </Text>
            <Text style={[styles.ausenteDica, { color: colors.textSecondary }]}>
              Ela pode ter sido excluída em outro momento. Volte à Biblioteca para ver
              as playlists disponíveis.
            </Text>
            <TouchableOpacity
              style={[styles.botaoVoltarBiblioteca, { backgroundColor: colors.button }]}
              onPress={() => navigation.navigate('Biblioteca')}
              activeOpacity={0.85}
            >
              <Icone nome="biblioteca" tamanho={14} cor={colors.buttonText} />
              <Text style={[styles.botaoVoltarTexto, { color: colors.buttonText }]}>
                Ir para a Biblioteca
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </FundoAtmosfera>
    );
  }

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {cabecalho}

        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Resumo da playlist */}
          <GlassCard style={styles.resumo}>
            <View style={styles.resumoTopo}>
              <View
                style={[
                  styles.resumoIcone,
                  {
                    backgroundColor: comAlfa(colors.primary, 0.14),
                    borderColor: comAlfa(colors.primary, 0.3),
                  },
                ]}
              >
                <Icone nome="playlist" tamanho={22} cor={colors.primary} />
              </View>
              <View style={styles.resumoTextos}>
                <Text style={[styles.resumoTitulo, { color: colors.text }]}>
                  {playlist.releases.length}{' '}
                  {playlist.releases.length === 1 ? 'versão' : 'versões'}
                </Text>
                <Text style={[styles.resumoSubtitulo, { color: colors.textSecondary }]}>
                  Criada em {new Date(playlist.criadaEm).toLocaleDateString('pt-BR')}
                </Text>
              </View>
            </View>

            {renomeando && (
              <View
                style={[styles.renomearBox, { borderTopColor: colors.glassBorder }]}
              >
                <Text style={[styles.rotuloCampo, { color: colors.textSecondary }]}>
                  NOME DA PLAYLIST
                </Text>
                <View style={styles.linhaRenomear}>
                  <TextInput
                    style={[
                      styles.campo,
                      {
                        backgroundColor: colors.input,
                        borderColor: colors.glassBorder,
                        color: colors.text,
                      },
                    ]}
                    value={nomeEdicao}
                    onChangeText={setNomeEdicao}
                    maxLength={60}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void salvarNome()}
                    accessibilityLabel="Novo nome da playlist"
                  />
                  <TouchableOpacity
                    style={[
                      styles.botaoSalvar,
                      {
                        backgroundColor: colors.button,
                        opacity: salvandoNome || !nomeEdicao.trim() ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => void salvarNome()}
                    disabled={salvandoNome || !nomeEdicao.trim()}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Salvar novo nome"
                  >
                    {salvandoNome ? (
                      <ActivityIndicator size="small" color={colors.buttonText} />
                    ) : (
                      <Icone nome="sucesso" tamanho={16} cor={colors.buttonText} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.botaoCancelar, { borderColor: colors.glassBorder }]}
                    onPress={() => setRenomeando(false)}
                    disabled={salvandoNome}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar renomeação"
                  >
                    <Icone nome="limpar" tamanho={16} cor={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </GlassCard>

          {/* Versões na ordem em que foram adicionadas */}
          {playlist.releases.length > 0 ? (
            playlist.releases.map((release, indice) => (
              <TouchableOpacity
                key={release.id}
                style={[
                  styles.cardRelease,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
                onPress={() => navigation.push('DetalheRelease', { release })}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${release.version_name}`}
              >
                <View style={styles.indiceBox}>
                  <Text style={[styles.indiceTexto, { color: colors.textSecondary }]}>
                    {indice + 1}
                  </Text>
                </View>

                {release.cover_url ? (
                  <Image
                    source={{ uri: release.cover_url }}
                    style={styles.capa}
                    resizeMode="cover"
                    accessibilityLabel={`Capa de ${release.version_name}`}
                  />
                ) : (
                  <View
                    style={[
                      styles.capa,
                      styles.semCapa,
                      { backgroundColor: colors.input, borderColor: colors.glassBorder },
                    ]}
                  >
                    <Icone nome="album" tamanho={18} cor={colors.textSecondary} />
                  </View>
                )}

                <View style={styles.infoRelease}>
                  <Text
                    style={[styles.tituloRelease, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {release.version_name}
                  </Text>
                  <Text
                    style={[styles.subtituloRelease, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {release.artist_name} · {release.work_title}
                  </Text>
                  <Text
                    style={[styles.tipoRelease, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {traduzirTipoRelease(release.release_type)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.botaoRemover,
                    { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                  ]}
                  onPress={() => confirmarRemocao(release)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${release.version_name} da playlist`}
                >
                  <Icone nome="limpar" tamanho={14} cor={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.vazio}>
              <View
                style={[
                  styles.vazioIcone,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
              >
                <Icone nome="musica" tamanho={24} cor={colors.textSecondary} />
              </View>
              <Text style={[styles.vazioTitulo, { color: colors.text }]}>
                Playlist vazia
              </Text>
              <Text style={[styles.vazioDica, { color: colors.textSecondary }]}>
                Abra uma versão e toque no ícone de playlist para guardá-la aqui.
              </Text>
              <TouchableOpacity
                style={[styles.botaoVoltarBiblioteca, { backgroundColor: colors.button }]}
                onPress={() => navigation.navigate('Busca')}
                activeOpacity={0.85}
              >
                <Icone nome="busca" tamanho={14} cor={colors.buttonText} />
                <Text style={[styles.botaoVoltarTexto, { color: colors.buttonText }]}>
                  Encontrar músicas
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.rodape, { color: colors.textSecondary }]}>
            As playlists ficam salvas neste aparelho. Remover uma versão da playlist
            não apaga o arquivo baixado.
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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 18 : 6,
    paddingBottom: 10,
  },
  botaoCirculo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoTextos: {
    flex: 1,
  },
  etiqueta: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  tituloTela: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  conteudo: {
    paddingTop: 6,
    paddingBottom: 130,
    paddingHorizontal: 18,
  },
  resumo: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 14,
  },
  resumoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumoIcone: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumoTextos: {
    flex: 1,
  },
  resumoTitulo: {
    fontSize: 17,
    fontWeight: '800',
  },
  resumoSubtitulo: {
    fontSize: 10.5,
    marginTop: 3,
  },
  renomearBox: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
  },
  rotuloCampo: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  linhaRenomear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  campo: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    fontSize: 13,
  },
  botaoSalvar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCancelar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRelease: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  indiceBox: {
    width: 18,
    alignItems: 'center',
  },
  indiceTexto: {
    fontSize: 10,
    fontWeight: '700',
  },
  capa: {
    width: 52,
    height: 52,
    borderRadius: 13,
  },
  semCapa: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  infoRelease: {
    flex: 1,
  },
  tituloRelease: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  subtituloRelease: {
    fontSize: 10,
    marginTop: 2,
  },
  tipoRelease: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },
  botaoRemover: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazio: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 20,
  },
  vazioIcone: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  vazioTitulo: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
    textAlign: 'center',
  },
  vazioDica: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 14,
  },
  ausente: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  ausenteIcone: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ausenteTitulo: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  ausenteDica: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  botaoVoltarBiblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  botaoVoltarTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  rodape: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 30,
    marginTop: 12,
  },
});
