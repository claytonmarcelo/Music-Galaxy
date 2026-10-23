// Tela de Biblioteca — resumo da coleção, favoritos, playlists e históricos.
// Todos os dados vêm dos contextos locais (AsyncStorage); nenhuma informação
// sai do aparelho. A interface usa os cartões de vidro fosco do projeto.

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
import { useFavoritos } from '../contexts/FavoritosContext';
import { usePlaylists } from '../contexts/PlaylistsContext';
import { useHistorico } from '../contexts/HistoricoContext';
import { useHistoricoReproducao } from '../contexts/HistoricoReproducaoContext';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { traduzirTipoRelease } from '../utils/tiposRelease';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'Biblioteca'>;

type AbaAtiva = 'estatisticas' | 'favoritos' | 'playlists' | 'historico';

const ABAS: Array<{ valor: AbaAtiva; rotulo: string; icone: NomeIcone }> = [
  { valor: 'estatisticas', rotulo: 'Resumo', icone: 'estatisticas' },
  { valor: 'favoritos', rotulo: 'Favoritos', icone: 'favorito' },
  { valor: 'playlists', rotulo: 'Playlists', icone: 'playlist' },
  { valor: 'historico', rotulo: 'Histórico', icone: 'relogio' },
];

export default function TelaBiblioteca({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { playlists, criarPlaylist, excluirPlaylist } = usePlaylists();
  const { historico, limparHistorico } = useHistorico();
  const { reproducoes, limparHistoricoReproducao } = useHistoricoReproducao();
  const { colors } = useTheme();
  const { abrirConfirmacao, toastSucesso, toastErro } = useModal();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('estatisticas');
  const [criandoPlaylist, setCriandoPlaylist] = useState(false);
  const [nomeNovaPlaylist, setNomeNovaPlaylist] = useState('');
  const [salvandoPlaylist, setSalvandoPlaylist] = useState(false);

  // Estatísticas derivadas dos favoritos locais.
  const artistasUnicos = new Set(favoritos.map((f) => f.artist_name));
  const obrasUnicas = new Set(favoritos.map((f) => f.work_title));
  const tiposRelease = new Set(favoritos.map((f) => f.release_type));

  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  const handleRemoverFavorito = (releaseId: number): void => {
    abrirConfirmacao(
      'Remover dos favoritos?',
      'Deseja remover esta versão dos favoritos?',
      () => removerFavorito(releaseId)
    );
  };

  const handleLimparHistorico = (): void => {
    abrirConfirmacao(
      'Limpar buscas recentes?',
      'Deseja limpar todo o histórico de buscas?',
      () => limparHistorico()
    );
  };

  const handleLimparReproducoes = (): void => {
    abrirConfirmacao(
      'Limpar reproduções recentes?',
      'O registro de reproduções será apagado. Nenhum arquivo baixado, favorito ou playlist será removido.',
      () => limparHistoricoReproducao()
    );
  };

  const handleExcluirPlaylist = (playlistId: string, nome: string): void => {
    abrirConfirmacao(
      'Excluir playlist?',
      `“${nome}” será removida do aparelho. As versões continuam nos favoritos e nenhum arquivo baixado será apagado.`,
      () => {
        void (async () => {
          try {
            await excluirPlaylist(playlistId);
            toastSucesso('Playlist excluída.');
          } catch (erro) {
            const mensagem =
              erro instanceof Error ? erro.message : 'Não foi possível excluir a playlist.';
            toastErro(mensagem);
          }
        })();
      }
    );
  };

  const confirmarCriacaoPlaylist = async (): Promise<void> => {
    if (salvandoPlaylist) return;
    setSalvandoPlaylist(true);

    try {
      const playlistId = await criarPlaylist(nomeNovaPlaylist);
      setCriandoPlaylist(false);
      setNomeNovaPlaylist('');
      toastSucesso('Playlist criada.');
      navigation.navigate('DetalhePlaylist', { playlistId });
    } catch (erro) {
      const mensagem =
        erro instanceof Error ? erro.message : 'Não foi possível criar a playlist.';
      toastErro(mensagem);
    } finally {
      setSalvandoPlaylist(false);
    }
  };

  const cardStat = (
    icone: NomeIcone,
    valor: number,
    label: string
  ): React.JSX.Element => (
    <GlassCard key={label} style={styles.cardStat} semBrilho>
      <View
        style={[
          styles.statIcone,
          { backgroundColor: comAlfa(colors.primary, 0.13), borderColor: comAlfa(colors.primary, 0.24) },
        ]}
      >
        <Icone nome={icone} tamanho={16} cor={colors.primary} />
      </View>
      <Text style={[styles.valorStat, { color: colors.text }]}>{valor}</Text>
      <Text style={[styles.labelStat, { color: colors.textSecondary }]}>{label}</Text>
    </GlassCard>
  );

  const estadoVazio = (icone: NomeIcone, titulo: string, dica: string): React.JSX.Element => (
    <View style={styles.containerVazio}>
      <View
        style={[
          styles.vazioIcone,
          { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        ]}
      >
        <Icone nome={icone} tamanho={26} cor={colors.textSecondary} />
      </View>
      <Text style={[styles.vazioTitulo, { color: colors.text }]}>{titulo}</Text>
      <Text style={[styles.vazioDica, { color: colors.textSecondary }]}>{dica}</Text>
    </View>
  );

  const renderEstatisticas = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <View style={styles.gridStats}>
        {cardStat('favorito', favoritos.length, 'Favoritos')}
        {cardStat('playlist', playlists.length, 'Playlists')}
        {cardStat('reproduzir', reproducoes.length, 'Reproduções')}
        {cardStat('fone', artistasUnicos.size, 'Artistas')}
        {cardStat('musica', obrasUnicas.size, 'Obras')}
        {cardStat('album', tiposRelease.size, 'Tipos')}
      </View>

      {favoritos.length > 0 ? (
        <GlassCard style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Icone nome="album" tamanho={14} cor={colors.primary} />
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>
              Tipos de versão favoritos
            </Text>
          </View>
          <View style={styles.containerTipos}>
            {Array.from(tiposRelease).map((tipo) => (
              <View
                key={tipo}
                style={[
                  styles.badgeTipo,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
              >
                <Text style={[styles.textoTipo, { color: colors.text }]}>
                  {traduzirTipoRelease(tipo)}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : playlists.length === 0 && reproducoes.length === 0 ? (
        estadoVazio(
          'biblioteca',
          'Sua biblioteca começa agora',
          'Adicione versões aos favoritos para acompanhar artistas, obras e formatos.'
        )
      ) : (
        <GlassCard style={styles.secao}>
          <View style={styles.secaoTituloLinha}>
            <Icone nome="biblioteca" tamanho={14} cor={colors.primary} />
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>
              Continue explorando
            </Text>
          </View>
          <Text style={[styles.vazioDica, { color: colors.textSecondary }]}>
            Suas playlists e reproduções já estão guardadas aqui. Toque no coração de
            uma versão para acompanhar artistas, obras e formatos neste resumo.
          </Text>
        </GlassCard>
      )}
    </View>
  );

  const renderFavoritos = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      {favoritos.length > 0 ? (
        <>
          <View style={styles.headerSecao}>
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>
              {favoritos.length} {favoritos.length === 1 ? 'versão favorita' : 'versões favoritas'}
            </Text>
          </View>

          {favoritos.map((release) => (
            <TouchableOpacity
              key={release.id}
              style={[
                styles.cardRelease,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => handleSelecionarRelease(release)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${release.version_name}`}
            >
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
                <Text style={[styles.tituloRelease, { color: colors.text }]} numberOfLines={2}>
                  {release.version_name}
                </Text>
                <Text style={[styles.subtituloRelease, { color: colors.textSecondary }]} numberOfLines={1}>
                  {release.artist_name} · {release.work_title}
                </Text>
                <Text style={[styles.tipoRelease, { color: colors.primary }]} numberOfLines={1}>
                  {traduzirTipoRelease(release.release_type)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.botaoRemover,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
                onPress={() => handleRemoverFavorito(release.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Remover ${release.version_name} dos favoritos`}
              >
                <Icone nome="lixeira" tamanho={14} cor={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        estadoVazio(
          'favorito',
          'Nenhum favorito ainda',
          'Toque no coração de uma versão para guardá-la aqui.'
        )
      )}
    </View>
  );

  const renderPlaylists = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <View style={styles.headerSecao}>
        <Text style={[styles.secaoTitulo, { color: colors.text }]}>
          {playlists.length === 0
            ? 'Suas playlists'
            : `${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}`}
        </Text>
        <TouchableOpacity
          style={[
            styles.botaoNovaPlaylist,
            {
              backgroundColor: criandoPlaylist ? colors.button : colors.glassCard,
              borderColor: criandoPlaylist ? colors.button : colors.glassBorder,
            },
          ]}
          onPress={() => {
            setCriandoPlaylist((atual) => !atual);
            setNomeNovaPlaylist('');
          }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={criandoPlaylist ? 'Cancelar nova playlist' : 'Criar nova playlist'}
        >
          <Icone
            nome={criandoPlaylist ? 'limpar' : 'mais'}
            tamanho={12}
            cor={criandoPlaylist ? colors.buttonText : colors.primary}
          />
          <Text
            style={[
              styles.textoBotaoNova,
              { color: criandoPlaylist ? colors.buttonText : colors.primary },
            ]}
          >
            {criandoPlaylist ? 'Cancelar' : 'Nova'}
          </Text>
        </TouchableOpacity>
      </View>

      {criandoPlaylist && (
        <GlassCard style={styles.criacaoCard} semBrilho>
          <Text style={[styles.rotuloCampo, { color: colors.textSecondary }]}>
            NOME DA NOVA PLAYLIST
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
              value={nomeNovaPlaylist}
              onChangeText={setNomeNovaPlaylist}
              placeholder="Ex.: Clássicos da pista"
              placeholderTextColor={colors.textSecondary}
              maxLength={60}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void confirmarCriacaoPlaylist()}
              accessibilityLabel="Nome da nova playlist"
            />
            <TouchableOpacity
              style={[
                styles.botaoCriar,
                {
                  backgroundColor: colors.button,
                  opacity: salvandoPlaylist || !nomeNovaPlaylist.trim() ? 0.55 : 1,
                },
              ]}
              onPress={() => void confirmarCriacaoPlaylist()}
              disabled={salvandoPlaylist || !nomeNovaPlaylist.trim()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Criar playlist"
            >
              {salvandoPlaylist ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Icone nome="mais" tamanho={16} cor={colors.buttonText} />
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}

      {playlists.length > 0 ? (
        playlists.map((playlist) => (
          <View
            key={playlist.id}
            style={[
              styles.cardPlaylist,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
          >
            <TouchableOpacity
              style={styles.playlistPrincipal}
              onPress={() =>
                navigation.navigate('DetalhePlaylist', { playlistId: playlist.id })
              }
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Abrir a playlist ${playlist.nome}`}
            >
              <View
                style={[
                  styles.playlistIcone,
                  {
                    backgroundColor: comAlfa(colors.primary, 0.13),
                    borderColor: comAlfa(colors.primary, 0.26),
                  },
                ]}
              >
                <Icone nome="playlist" tamanho={17} cor={colors.primary} />
              </View>

              <View style={styles.playlistTextos}>
                <Text
                  style={[styles.playlistNome, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {playlist.nome}
                </Text>
                <Text
                  style={[styles.playlistMeta, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {playlist.releases.length}{' '}
                  {playlist.releases.length === 1 ? 'versão' : 'versões'} ·{' '}
                  {formatarData(new Date(playlist.atualizadaEm))}
                </Text>
              </View>

              <Icone nome="seta" tamanho={15} cor={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botaoRemover,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => handleExcluirPlaylist(playlist.id, playlist.nome)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Excluir a playlist ${playlist.nome}`}
            >
              <Icone nome="lixeira" tamanho={14} cor={colors.error} />
            </TouchableOpacity>
          </View>
        ))
      ) : (
        !criandoPlaylist &&
        estadoVazio(
          'playlist',
          'Nenhuma playlist ainda',
          'Crie uma playlist e guarde versões na ordem em que quiser ouvi-las.'
        )
      )}
    </View>
  );

  const renderHistorico = (): React.JSX.Element => {
    if (historico.length === 0 && reproducoes.length === 0) {
      return (
        <View style={styles.conteudoAba}>
          {estadoVazio(
            'relogio',
            'Histórico vazio',
            'As buscas que você fizer e as músicas que ouvir aparecem aqui para voltar rapidinho.'
          )}
        </View>
      );
    }

    return (
      <View style={styles.conteudoAba}>
        {/* Buscas recentes */}
        <View style={styles.headerSecao}>
          <Text style={[styles.secaoTitulo, { color: colors.text }]}>
            {historico.length}{' '}
            {historico.length === 1 ? 'busca recente' : 'buscas recentes'}
          </Text>
          {historico.length > 0 && (
            <TouchableOpacity
              style={[styles.botaoLimpar, { borderColor: colors.glassBorder }]}
              onPress={handleLimparHistorico}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico de buscas"
            >
              <Icone nome="lixeira" tamanho={12} cor={colors.error} />
              <Text style={[styles.textoLimpar, { color: colors.error }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        {historico.length > 0 ? (
          <GlassCard style={styles.listaHistorico} semBrilho>
            {historico.map((item, indice) => (
              <View
                key={`${item.termo}-${item.timestamp}`}
                style={[
                  styles.itemHistorico,
                  indice < historico.length - 1 && { borderBottomColor: colors.glassBorder, borderBottomWidth: 1 },
                ]}
              >
                <View
                  style={[
                    styles.historicoIcone,
                    { backgroundColor: colors.glassCard },
                  ]}
                >
                  <Icone nome="relogio" tamanho={13} cor={colors.textSecondary} />
                </View>
                <Text style={[styles.textoHistorico, { color: colors.text }]} numberOfLines={1}>
                  {item.termo}
                </Text>
                <Text style={[styles.dataHistorico, { color: colors.textSecondary }]}>
                  {formatarData(new Date(item.timestamp))}
                </Text>
              </View>
            ))}
          </GlassCard>
        ) : (
          <Text style={[styles.dicaSecao, { color: colors.textSecondary }]}>
            Nenhuma busca registrada ainda.
          </Text>
        )}

        {/* Reproduções recentes */}
        <View style={[styles.headerSecao, styles.headerSecaoEspacado]}>
          <Text style={[styles.secaoTitulo, { color: colors.text }]}>
            {reproducoes.length}{' '}
            {reproducoes.length === 1 ? 'reprodução recente' : 'reproduções recentes'}
          </Text>
          {reproducoes.length > 0 && (
            <TouchableOpacity
              style={[styles.botaoLimpar, { borderColor: colors.glassBorder }]}
              onPress={handleLimparReproducoes}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico de reproduções"
            >
              <Icone nome="lixeira" tamanho={12} cor={colors.error} />
              <Text style={[styles.textoLimpar, { color: colors.error }]}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        {reproducoes.length > 0 ? (
          reproducoes.map((item) => (
            <TouchableOpacity
              key={item.release.id}
              style={[
                styles.cardRelease,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => handleSelecionarRelease(item.release)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.release.version_name}`}
            >
              {item.release.cover_url ? (
                <Image
                  source={{ uri: item.release.cover_url }}
                  style={styles.capa}
                  resizeMode="cover"
                  accessibilityLabel={`Capa de ${item.release.version_name}`}
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
                <Text style={[styles.tituloRelease, { color: colors.text }]} numberOfLines={2}>
                  {item.release.version_name}
                </Text>
                <Text style={[styles.subtituloRelease, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.release.artist_name} · {item.release.work_title}
                </Text>
                <Text style={[styles.tipoRelease, { color: colors.primary }]} numberOfLines={1}>
                  {traduzirTipoRelease(item.release.release_type)}
                </Text>
              </View>

              <Text style={[styles.dataHistorico, { color: colors.textSecondary }]}>
                {formatarData(new Date(item.reproduzidoEm))}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.dicaSecao, { color: colors.textSecondary }]}>
            Nenhuma música reproduzida ainda.
          </Text>
        )}
      </View>
    );
  };

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.cabecalho}>
          <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>SUA COLEÇÃO</Text>
          <Text style={[styles.titulo, { color: colors.text }]}>Biblioteca</Text>
        </View>

        {/* Abas em pílulas de vidro */}
        <View style={styles.containerAbas}>
          {ABAS.map((aba) => {
            const ativa = abaAtiva === aba.valor;
            return (
              <TouchableOpacity
                key={aba.valor}
                style={[
                  styles.aba,
                  {
                    backgroundColor: ativa ? colors.button : colors.glassCard,
                    borderColor: ativa ? colors.button : colors.glassBorder,
                  },
                ]}
                onPress={() => setAbaAtiva(aba.valor)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: ativa }}
              >
                <Icone
                  nome={aba.icone}
                  tamanho={13}
                  cor={ativa ? colors.buttonText : colors.textSecondary}
                />
                <Text
                  style={[styles.textoAba, { color: ativa ? colors.buttonText : colors.text }]}
                  numberOfLines={1}
                >
                  {aba.rotulo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {abaAtiva === 'estatisticas' && renderEstatisticas()}
          {abaAtiva === 'favoritos' && renderFavoritos()}
          {abaAtiva === 'playlists' && renderPlaylists()}
          {abaAtiva === 'historico' && renderHistorico()}

          {abaAtiva === 'favoritos' && favoritos.length > 0 && (
            <View style={styles.rodapeAcao}>
              <CustomButton
                title="Abrir todos os favoritos"
                variant="secondary"
                icone="favorito"
                iconeDireita
                onPress={() => navigation.navigate('Favoritos')}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

// Tempo relativo curto em português brasileiro.
function formatarData(data: Date): string {
  const agora = new Date();
  const diferenca = agora.getTime() - data.getTime();
  const minutos = Math.floor(diferenca / 60000);
  const horas = Math.floor(diferenca / 3600000);
  const dias = Math.floor(diferenca / 86400000);

  if (minutos < 1) return 'Agora';
  if (minutos < 60) return `${minutos} min`;
  if (horas < 24) return `${horas} h`;
  if (dias < 7) return `${dias} d`;

  return data.toLocaleDateString('pt-BR');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 22 : 8,
    paddingBottom: 10,
  },
  etiqueta: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  containerAbas: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoAba: {
    fontSize: 9.8,
    fontWeight: '600',
  },
  conteudo: {
    paddingTop: 6,
    paddingBottom: 130,
    paddingHorizontal: 20,
  },
  conteudoAba: {
    paddingBottom: 8,
  },
  gridStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  cardStat: {
    width: '48%',
    padding: 15,
    borderRadius: 22,
    marginBottom: 2,
  },
  statIcone: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  valorStat: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  labelStat: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  secao: {
    padding: 16,
    borderRadius: 22,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 11,
  },
  secaoTitulo: {
    fontSize: 13,
    fontWeight: '700',
  },
  containerTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  badgeTipo: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoTipo: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardRelease: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  capa: {
    width: 54,
    height: 54,
    borderRadius: 14,
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
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  subtituloRelease: {
    fontSize: 10,
    marginTop: 2,
  },
  tipoRelease: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 3,
  },
  botaoRemover: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerSecaoEspacado: {
    marginTop: 18,
  },
  botaoLimpar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoLimpar: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  listaHistorico: {
    padding: 4,
    borderRadius: 22,
  },
  itemHistorico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  historicoIcone: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoHistorico: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
  },
  dataHistorico: {
    fontSize: 9.5,
  },
  dicaSecao: {
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  containerVazio: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  vazioIcone: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
  },
  rodapeAcao: {
    alignItems: 'center',
    marginTop: 12,
  },
  botaoNovaPlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoBotaoNova: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  criacaoCard: {
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  rotuloCampo: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  linhaCriacao: {
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
    fontSize: 12.5,
  },
  botaoCriar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    paddingRight: 10,
  },
  playlistPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    paddingRight: 4,
  },
  playlistIcone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistTextos: {
    flex: 1,
  },
  playlistNome: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  playlistMeta: {
    fontSize: 10,
    marginTop: 3,
  },
});
