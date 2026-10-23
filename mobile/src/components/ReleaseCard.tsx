// Card de versão (release).
// Mostra a capa oficial quando existir (Regra 1), os metadados da versão,
// duas ações diretas — ouvir e baixar — e o player embutido ao expandir.
// O download rápido usa a qualidade padrão escolhida em Ajustes e sempre
// passa pelo endpoint do backend, que resolve a fonte em sites abertos.

import React, { useState, memo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { Release } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { useHistoricoReproducao } from '../contexts/HistoricoReproducaoContext';
import AnimatedCard from './AnimatedCard';
import Icone from './Icone';
import PlayerControls from './PlayerControls';
import { traduzirTipoRelease } from '../utils/tiposRelease';
import { comAlfa } from '../utils/cores';
import { downloadManager, EstadoDownload } from '../services/downloadManager';
import {
  FormatoDownload,
  QUALIDADE_PADRAO,
  obterQualidadePadrao,
  urlDownloadRelease,
  urlStreamRelease,
  nomeBaseArquivoRelease,
  rotuloQualidade,
} from '../services/downloadRelease';

interface Props {
  release: Release;
  onPress: (release: Release) => void;
}

// Cores de destaque por categoria, sempre resolvidas pelos tokens do tema.
function corDaCategoria(
  cores: ReturnType<typeof useTheme>['colors'],
  categoria?: string
): string {
  switch (categoria) {
    case 'release_format':
      return cores.success;
    case 'mix_edit':
      return cores.luzSecundaria;
    case 'instrumental':
      return cores.luzPrimaria;
    case 'playback':
      return cores.warning;
    default:
      return cores.textSecondary;
  }
}

function ReleaseCardComponent({ release, onPress }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { toastSucesso, toastErro } = useModal();
  const { registrarReproducao } = useHistoricoReproducao();
  const isFocused = useIsFocused();

  const [showPlayer, setShowPlayer] = useState(false);
  const [qualidade, setQualidade] = useState<FormatoDownload>(QUALIDADE_PADRAO);
  const [urlAtual, setUrlAtual] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDownload | null>(null);
  const [baixandoAgora, setBaixandoAgora] = useState(false);
  const [arquivoLocal, setArquivoLocal] = useState<string | null>(null);

  const corCategoria = corDaCategoria(colors, release.release_type_category);

  // Ao abrir o player compacto, procura um arquivo já baixado desta versão
  // para permitir a reprodução offline.
  useEffect(() => {
    if (!showPlayer) return;

    let ativo = true;
    void downloadManager.obterArquivoLocal(release.id).then((caminho) => {
      if (ativo) setArquivoLocal(caminho);
    });

    return () => {
      ativo = false;
    };
  }, [showPlayer, release.id]);

  // Relê a preferência sempre que a tela volta ao foco (ex.: após Ajustes).
  useEffect(() => {
    if (!isFocused) return;
    let ativo = true;
    obterQualidadePadrao().then((formato) => {
      if (ativo) setQualidade(formato);
    });
    return () => {
      ativo = false;
    };
  }, [isFocused]);

  // Acompanha o progresso do download iniciado neste card.
  useEffect(() => {
    if (!urlAtual) return;
    setEstado(downloadManager.obterEstado(urlAtual));
    return downloadManager.subscribe(urlAtual, setEstado);
  }, [urlAtual]);

  const iniciarDownload = useCallback(async () => {
    if (baixandoAgora) return;

    const formato = await obterQualidadePadrao();
    setQualidade(formato);
    const url = urlDownloadRelease(release.id, formato);
    setUrlAtual(url);
    setBaixandoAgora(true);

    try {
      await downloadManager.baixar(url, nomeBaseArquivoRelease(release));
      toastSucesso(`Download em ${rotuloQualidade(formato)} concluído!`);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro ao baixar o arquivo.';
      toastErro(mensagem);
    } finally {
      setBaixandoAgora(false);
    }
  }, [baixandoAgora, release, toastSucesso, toastErro]);

  const progresso = Math.round((estado?.progresso ?? 0) * 100);
  const emDownload = baixandoAgora || estado?.baixando === true;
  const concluido = estado?.concluido === true;

  return (
    <AnimatedCard style={styles.container} animationType="slideUp" delay={0}>
      {/* Conteúdo principal — toque abre os detalhes da versão */}
      <TouchableOpacity
        style={styles.corpo}
        onPress={() => onPress(release)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Abrir detalhes de ${release.version_name}`}
      >
        <View style={styles.capaContainer}>
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
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="album" tamanho={26} cor={colors.textSecondary} />
              <Text style={[styles.semCapaTexto, { color: colors.textSecondary }]}>
                Sem capa
              </Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {release.artist_name}
          </Text>
          <Text style={[styles.versao, { color: colors.text }]} numberOfLines={2}>
            {release.version_name}
          </Text>

          <View style={styles.metadados}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: comAlfa(corCategoria, 0.14),
                  borderColor: comAlfa(corCategoria, 0.35),
                },
              ]}
            >
              <Text style={[styles.chipTexto, { color: corCategoria }]} numberOfLines={1}>
                {traduzirTipoRelease(release.release_type)}
              </Text>
            </View>

            {release.release_year && (
              <View style={styles.metaItem}>
                <Icone nome="calendario" tamanho={11} cor={colors.textSecondary} />
                <Text style={[styles.metaTexto, { color: colors.textSecondary }]}>
                  {release.release_year}
                </Text>
              </View>
            )}

            {release.quality && (
              <View style={styles.metaItem}>
                <Icone nome="qualidade" tamanho={11} cor={colors.textSecondary} />
                <Text style={[styles.metaTexto, { color: colors.textSecondary }]} numberOfLines={1}>
                  {release.quality}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.fonte, { color: colors.textSecondary }]} numberOfLines={1}>
            {release.metadata_source}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Ações diretas */}
      <View style={styles.acoes}>
        <TouchableOpacity
          style={[
            styles.acaoSecundaria,
            { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
          ]}
          onPress={() => setShowPlayer((atual) => !atual)}
          activeOpacity={0.75}
          accessibilityLabel={showPlayer ? 'Fechar player' : 'Ouvir esta versão'}
        >
          <Icone
            nome={showPlayer ? 'setaBaixo' : 'reproduzir'}
            tamanho={15}
            cor={colors.text}
          />
          <Text style={[styles.acaoTexto, { color: colors.text }]}>
            {showPlayer ? 'Fechar' : 'Ouvir'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.acaoPrimaria,
            { backgroundColor: colors.button },
            emDownload && styles.acaoDesabilitada,
          ]}
          onPress={iniciarDownload}
          disabled={emDownload}
          activeOpacity={0.8}
          accessibilityLabel={`Baixar em ${rotuloQualidade(qualidade)}`}
        >
          <Icone
            nome={concluido ? 'sucessoCirculo' : emDownload ? 'relogio' : 'download'}
            tamanho={15}
            cor={colors.buttonText}
          />
          <Text style={[styles.acaoTexto, { color: colors.buttonText }]}>
            {emDownload
              ? `Baixando ${progresso}%`
              : concluido
                ? 'Salvo'
                : `Baixar ${rotuloQualidade(qualidade)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barra fina de progresso abaixo das ações */}
      {emDownload && (
        <View style={[styles.barraFundo, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.barraProgresso,
              { backgroundColor: colors.primary, width: `${progresso}%` },
            ]}
          />
        </View>
      )}

      {showPlayer && (
        <PlayerControls
          url={urlStreamRelease(release.id)}
          urlLocal={arquivoLocal}
          titulo={release.version_name}
          artista={release.artist_name}
          onReproduzir={() => {
            void registrarReproducao(release);
          }}
          compacto
        />
      )}
    </AnimatedCard>
  );
}

// Memoização: evita re-render quando o card não mudou.
export default memo(ReleaseCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.release.id === nextProps.release.id &&
    prevProps.release.cover_url === nextProps.release.cover_url &&
    prevProps.release.version_name === nextProps.release.version_name &&
    prevProps.release.artist_name === nextProps.release.artist_name
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 7,
    padding: 12,
  },
  corpo: {
    flexDirection: 'row',
  },
  capaContainer: {
    width: 88,
    height: 88,
  },
  capa: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },
  semCapa: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 4,
  },
  semCapaTexto: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: 'space-between',
    minHeight: 88,
    gap: 4,
  },
  artista: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  versao: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  metadados: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 150,
  },
  chipTexto: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTexto: {
    fontSize: 10,
    fontWeight: '500',
  },
  fonte: {
    fontSize: 9,
    opacity: 0.8,
  },
  acoes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  acaoSecundaria: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  acaoPrimaria: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  acaoDesabilitada: {
    opacity: 0.75,
  },
  acaoTexto: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  barraFundo: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  barraProgresso: {
    height: '100%',
    borderRadius: 2,
  },
});
