// Tela de Biblioteca — resumo da coleção, favoritos e histórico de buscas.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useHistorico } from '../contexts/HistoricoContext';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import CustomButton from '../components/CustomButton';
import { traduzirTipoRelease } from '../utils/tiposRelease';
import { comAlfa } from '../utils/cores';

type Props = NativeStackScreenProps<RootStackParamList, 'Biblioteca'>;

type AbaAtiva = 'estatisticas' | 'favoritos' | 'historico';

const ABAS: Array<{ valor: AbaAtiva; rotulo: string; icone: NomeIcone }> = [
  { valor: 'estatisticas', rotulo: 'Resumo', icone: 'estatisticas' },
  { valor: 'favoritos', rotulo: 'Favoritos', icone: 'favorito' },
  { valor: 'historico', rotulo: 'Histórico', icone: 'relogio' },
];

export default function TelaBiblioteca({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { historico, limparHistorico } = useHistorico();
  const { colors } = useTheme();
  const { abrirConfirmacao } = useModal();
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('estatisticas');

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
      'Limpar histórico?',
      'Deseja limpar todo o histórico de buscas?',
      () => limparHistorico()
    );
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
      ) : (
        estadoVazio(
          'biblioteca',
          'Sua biblioteca começa agora',
          'Adicione versões aos favoritos para acompanhar artistas, obras e formatos.'
        )
      )}
    </View>
  );

  const renderFavoritos = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      {favoritos.length > 0 ? (
        favoritos.map((release) => (
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
              accessibilityLabel={`Remover ${release.version_name} dos favoritos`}
            >
              <Icone nome="lixeira" tamanho={14} cor={colors.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      ) : (
        estadoVazio(
          'favorito',
          'Nenhum favorito ainda',
          'Toque no coração de uma versão para guardá-la aqui.'
        )
      )}
    </View>
  );

  const renderHistorico = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      {historico.length > 0 ? (
        <>
          <View style={styles.headerSecao}>
            <Text style={[styles.secaoTitulo, { color: colors.text }]}>
              {historico.length} {historico.length === 1 ? 'busca recente' : 'buscas recentes'}
            </Text>
            <TouchableOpacity
              style={[styles.botaoLimpar, { borderColor: colors.glassBorder }]}
              onPress={handleLimparHistorico}
              activeOpacity={0.7}
              accessibilityLabel="Limpar histórico de buscas"
            >
              <Icone nome="lixeira" tamanho={12} cor={colors.error} />
              <Text style={[styles.textoLimpar, { color: colors.error }]}>Limpar</Text>
            </TouchableOpacity>
          </View>

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
        </>
      ) : (
        estadoVazio(
          'relogio',
          'Histórico vazio',
          'As buscas que você fizer aparecem aqui para voltar rapidinho.'
        )
      )}
    </View>
  );

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
            const contagem =
              aba.valor === 'favoritos'
                ? favoritos.length
                : aba.valor === 'historico'
                  ? historico.length
                  : undefined;
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
                accessibilityState={{ selected: ativa }}
              >
                <Icone
                  nome={aba.icone}
                  tamanho={14}
                  cor={ativa ? colors.buttonText : colors.textSecondary}
                />
                <Text
                  style={[styles.textoAba, { color: ativa ? colors.buttonText : colors.text }]}
                  numberOfLines={1}
                >
                  {aba.rotulo}
                  {contagem !== undefined && contagem > 0 ? ` (${contagem})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
        >
          {abaAtiva === 'estatisticas' && renderEstatisticas()}
          {abaAtiva === 'favoritos' && renderFavoritos()}
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
    gap: 7,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  textoAba: {
    fontSize: 10.5,
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
});
