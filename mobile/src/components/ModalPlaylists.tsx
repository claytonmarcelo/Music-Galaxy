// Modal de playlists — aberto a partir dos detalhes de uma versão.
// Permite guardar ou remover a versão em qualquer playlist local e criar
// uma nova playlist sem sair da tela. Todo o conteúdo fica no aparelho;
// nenhuma informação é enviada ao servidor.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Release } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { usePlaylists } from '../contexts/PlaylistsContext';
import Icone from './Icone';
import { comAlfa } from '../utils/cores';

interface Props {
  visivel: boolean;
  release: Release;
  onFechar: () => void;
}

export default function ModalPlaylists({
  visivel,
  release,
  onFechar,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { toastSucesso, toastErro, toastInfo } = useModal();
  const {
    playlists,
    carregando,
    criarPlaylist,
    adicionarRelease,
    removerRelease,
    playlistContem,
  } = usePlaylists();

  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);

  const alternarNaPlaylist = async (playlistId: string, nome: string): Promise<void> => {
    if (acaoEmAndamento) return;
    setAcaoEmAndamento(playlistId);

    try {
      if (playlistContem(playlistId, release.id)) {
        await removerRelease(playlistId, release.id);
        toastInfo(`Removida de “${nome}”.`);
      } else {
        const adicionou = await adicionarRelease(playlistId, release);
        if (adicionou) {
          toastSucesso(`Adicionada a “${nome}”.`);
        }
      }
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível atualizar a playlist.';
      toastErro(mensagem);
    } finally {
      setAcaoEmAndamento(null);
    }
  };

  const criarEAdicionar = async (): Promise<void> => {
    if (criando) return;
    setCriando(true);

    try {
      const playlistId = await criarPlaylist(novoNome);
      await adicionarRelease(playlistId, release);
      setNovoNome('');
      toastSucesso('Playlist criada e versão adicionada.');
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível criar a playlist.';
      toastErro(mensagem);
    } finally {
      setCriando(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.veu, { backgroundColor: colors.backdrop }]}
      >
        <View
          style={[
            styles.cartao,
            {
              backgroundColor: colors.glassCardForte,
              borderColor: colors.glassBorder,
              shadowColor: colors.glassShadow,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.brilho, { backgroundColor: colors.glassHighlight }]}
          />

          {/* Cabeçalho */}
          <View style={styles.cabecalho}>
            <View
              style={[
                styles.selo,
                {
                  backgroundColor: comAlfa(colors.primary, 0.14),
                  borderColor: comAlfa(colors.primary, 0.3),
                },
              ]}
            >
              <Icone nome="playlist" tamanho={18} cor={colors.primary} />
            </View>
            <View style={styles.cabecalhoTextos}>
              <Text style={[styles.titulo, { color: colors.text }]}>Playlists</Text>
              <Text
                style={[styles.subtitulo, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                Escolha onde guardar “{release.version_name}”.
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.botaoFechar,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={onFechar}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Fechar playlists"
            >
              <Icone nome="limpar" tamanho={16} cor={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />

          {/* Lista de playlists */}
          {carregando ? (
            <View style={styles.carregando}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.carregandoTexto, { color: colors.textSecondary }]}>
                Carregando playlists...
              </Text>
            </View>
          ) : playlists.length > 0 ? (
            <ScrollView
              style={styles.lista}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {playlists.map((playlist, indice) => {
                const contem = playlistContem(playlist.id, release.id);
                const ocupada = acaoEmAndamento === playlist.id;

                return (
                  <TouchableOpacity
                    key={playlist.id}
                    style={[
                      styles.linha,
                      indice < playlists.length - 1 && {
                        borderBottomColor: colors.glassBorder,
                        borderBottomWidth: 1,
                      },
                    ]}
                    onPress={() => void alternarNaPlaylist(playlist.id, playlist.nome)}
                    disabled={acaoEmAndamento !== null}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel={
                      contem
                        ? `Remover de ${playlist.nome}`
                        : `Adicionar a ${playlist.nome}`
                    }
                    accessibilityState={{ selected: contem }}
                  >
                    <View
                      style={[
                        styles.iconeLinha,
                        {
                          backgroundColor: contem
                            ? comAlfa(colors.success, 0.15)
                            : colors.glassCard,
                          borderColor: contem
                            ? comAlfa(colors.success, 0.34)
                            : colors.glassBorder,
                        },
                      ]}
                    >
                      <Icone
                        nome={contem ? 'sucesso' : 'playlist'}
                        tamanho={14}
                        cor={contem ? colors.success : colors.textSecondary}
                      />
                    </View>

                    <View style={styles.textosLinha}>
                      <Text style={[styles.nomeLinha, { color: colors.text }]} numberOfLines={1}>
                        {playlist.nome}
                      </Text>
                      <Text
                        style={[styles.contagemLinha, { color: colors.textSecondary }]}
                      >
                        {playlist.releases.length}{' '}
                        {playlist.releases.length === 1 ? 'versão' : 'versões'}
                      </Text>
                    </View>

                    {ocupada ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View
                        style={[
                          styles.marca,
                          {
                            borderColor: contem
                              ? colors.success
                              : colors.glassBorder,
                            backgroundColor: contem
                              ? comAlfa(colors.success, 0.16)
                              : 'transparent',
                          },
                        ]}
                      >
                        {contem && <Icone nome="sucesso" tamanho={11} cor={colors.success} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.vazio}>
              <Icone nome="playlist" tamanho={22} cor={colors.textSecondary} />
              <Text style={[styles.vazioTitulo, { color: colors.text }]}>
                Nenhuma playlist ainda
              </Text>
              <Text style={[styles.vazioDica, { color: colors.textSecondary }]}>
                Crie a primeira abaixo para guardar esta versão.
              </Text>
            </View>
          )}

          <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />

          {/* Criar playlist */}
          <Text style={[styles.rotuloCampo, { color: colors.textSecondary }]}>
            CRIAR NOVA PLAYLIST
          </Text>
          <View style={styles.linhaCriacao}>
            <TextInput
              style={[
                styles.campo,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.glassBorder,
                  color: colors.text,
                },
              ]}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da playlist"
              placeholderTextColor={colors.textSecondary}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => void criarEAdicionar()}
              accessibilityLabel="Nome da nova playlist"
            />
            <TouchableOpacity
              style={[
                styles.botaoCriar,
                {
                  backgroundColor: colors.button,
                  opacity: criando || !novoNome.trim() ? 0.55 : 1,
                },
              ]}
              onPress={() => void criarEAdicionar()}
              disabled={criando || !novoNome.trim()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Criar playlist"
            >
              {criando ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Icone nome="mais" tamanho={16} cor={colors.buttonText} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veu: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  cartao: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 16,
  },
  brilho: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1,
    opacity: 0.7,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  selo: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoTextos: {
    flex: 1,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitulo: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divisor: {
    height: 1,
    marginVertical: 14,
  },
  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 22,
  },
  carregandoTexto: {
    fontSize: 12,
  },
  lista: {
    maxHeight: 260,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
  },
  iconeLinha: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosLinha: {
    flex: 1,
  },
  nomeLinha: {
    fontSize: 13,
    fontWeight: '700',
  },
  contagemLinha: {
    fontSize: 10,
    marginTop: 2,
  },
  marca: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vazio: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  vazioTitulo: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  vazioDica: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 260,
  },
  rotuloCampo: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  linhaCriacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campo: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  botaoCriar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
