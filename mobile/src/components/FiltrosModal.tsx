// Modal de filtros avançados da busca.
// Folha inferior de vidro fosco com categorias ilustradas por ícones de
// linha e faixas de ano em pílulas. Os filtros são aplicados somente aos
// resultados da busca atual — nada é enviado ao servidor.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icone, { NomeIcone } from './Icone';
import CustomButton from './CustomButton';
import { comAlfa } from '../utils/cores';

export interface Filtros {
  categoria?: string;
  anoMin?: number;
  anoMax?: number;
}

interface Props {
  visivel: boolean;
  filtrosAtuais: Filtros;
  onFechar: () => void;
  onAplicar: (filtros: Filtros) => void;
  onLimpar: () => void;
}

const CATEGORIAS: Array<{ valor: string; label: string; icone: NomeIcone }> = [
  { valor: 'release_format', label: 'Formato de lançamento', icone: 'album' },
  { valor: 'mix_edit', label: 'Mixagem / edição', icone: 'ondas' },
  { valor: 'instrumental', label: 'Instrumental', icone: 'musica' },
  { valor: 'playback', label: 'Playback', icone: 'fone' },
];

const ANOS_POPULARES = [
  { valor: [2020, 2024], label: '2020–2024' },
  { valor: [2010, 2019], label: '2010–2019' },
  { valor: [2000, 2009], label: '2000–2009' },
  { valor: [1990, 1999], label: '1990–1999' },
  { valor: [1980, 1989], label: '1980–1989' },
  { valor: [1970, 1979], label: '1970–1979' },
] as const;

export default function FiltrosModal({
  visivel,
  filtrosAtuais,
  onFechar,
  onAplicar,
  onLimpar,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const [filtros, setFiltros] = useState<Filtros>(filtrosAtuais);

  // Reabre sempre com o estado atual da busca (nunca com sobras antigas).
  useEffect(() => {
    if (visivel) setFiltros(filtrosAtuais);
  }, [visivel, filtrosAtuais]);

  const selecionarCategoria = (categoria: string) => {
    setFiltros((prev) => ({
      ...prev,
      categoria: prev.categoria === categoria ? undefined : categoria,
    }));
  };

  const selecionarAno = (anoMin: number, anoMax: number) => {
    const mesmoAno = filtros.anoMin === anoMin && filtros.anoMax === anoMax;
    setFiltros((prev) => ({
      ...prev,
      anoMin: mesmoAno ? undefined : anoMin,
      anoMax: mesmoAno ? undefined : anoMax,
    }));
  };

  const handleAplicar = () => {
    onAplicar(filtros);
    onFechar();
  };

  const handleLimpar = () => {
    setFiltros({});
    onLimpar();
    onFechar();
  };

  const contadorFiltros =
    (filtros.categoria ? 1 : 0) + (filtros.anoMin !== undefined ? 1 : 0);

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={true}
      onRequestClose={onFechar}
    >
      <View style={[styles.overlay, { backgroundColor: colors.backdrop }]}>
        {/* Toque fora da folha fecha o modal */}
        <TouchableOpacity
          style={styles.areaFechar}
          activeOpacity={1}
          onPress={onFechar}
          accessibilityLabel="Fechar filtros"
        />

        <View
          style={[
            styles.container,
            { backgroundColor: colors.glassCardForte, borderTopColor: colors.glassBorder },
          ]}
        >
          <View style={[styles.pegador, { backgroundColor: colors.glassBorder }]} />

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerTexto}>
              <Text style={[styles.titulo, { color: colors.text }]}>Filtros</Text>
              <Text style={[styles.subtitulo, { color: colors.textSecondary }]}>
                Refine as versões da busca atual
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.botaoFechar,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={onFechar}
              activeOpacity={0.75}
              accessibilityLabel="Fechar filtros"
            >
              <Icone nome="limpar" tamanho={16} cor={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.conteudo} showsVerticalScrollIndicator={false}>
            {/* Categoria */}
            <View style={styles.secao}>
              <View style={styles.secaoTituloLinha}>
                <Icone nome="filtro" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.secaoTitulo, { color: colors.textSecondary }]}>
                  CATEGORIA
                </Text>
              </View>

              <View style={styles.opcoesCategoria}>
                {CATEGORIAS.map((cat) => {
                  const selecionado = filtros.categoria === cat.valor;
                  return (
                    <TouchableOpacity
                      key={cat.valor}
                      style={[
                        styles.opcaoCategoria,
                        {
                          backgroundColor: selecionado
                            ? comAlfa(colors.primary, 0.16)
                            : colors.glassCard,
                          borderColor: selecionado ? colors.primary : colors.glassBorder,
                        },
                      ]}
                      onPress={() => selecionarCategoria(cat.valor)}
                      activeOpacity={0.75}
                      accessibilityState={{ selected: selecionado }}
                      accessibilityLabel={cat.label}
                    >
                      <View
                        style={[
                          styles.opcaoIcone,
                          {
                            backgroundColor: selecionado
                              ? comAlfa(colors.primary, 0.2)
                              : colors.glassCard,
                          },
                        ]}
                      >
                        <Icone
                          nome={cat.icone}
                          tamanho={16}
                          cor={selecionado ? colors.primary : colors.textSecondary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.opcaoCategoriaTexto,
                          { color: selecionado ? colors.primary : colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {cat.label}
                      </Text>
                      {selecionado && (
                        <Icone nome="sucessoCirculo" tamanho={15} cor={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Ano de lançamento */}
            <View style={styles.secao}>
              <View style={styles.secaoTituloLinha}>
                <Icone nome="calendario" tamanho={13} cor={colors.textSecondary} />
                <Text style={[styles.secaoTitulo, { color: colors.textSecondary }]}>
                  DÉCADA DE LANÇAMENTO
                </Text>
              </View>

              <View style={styles.opcoesAno}>
                {ANOS_POPULARES.map((ano) => {
                  const selecionado =
                    filtros.anoMin === ano.valor[0] && filtros.anoMax === ano.valor[1];
                  return (
                    <TouchableOpacity
                      key={ano.label}
                      style={[
                        styles.opcaoAno,
                        {
                          backgroundColor: selecionado
                            ? comAlfa(colors.primary, 0.16)
                            : colors.glassCard,
                          borderColor: selecionado ? colors.primary : colors.glassBorder,
                        },
                      ]}
                      onPress={() => selecionarAno(ano.valor[0], ano.valor[1])}
                      activeOpacity={0.75}
                      accessibilityState={{ selected: selecionado }}
                    >
                      <Text
                        style={[
                          styles.opcaoAnoTexto,
                          { color: selecionado ? colors.primary : colors.text },
                        ]}
                      >
                        {ano.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Aviso */}
            <View
              style={[
                styles.info,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="info" tamanho={14} cor={colors.primary} />
              <Text style={[styles.infoTexto, { color: colors.textSecondary }]}>
                Os filtros valem apenas para os resultados desta busca. Nada é enviado ao servidor.
              </Text>
            </View>
          </ScrollView>

          {/* Rodapé com ações */}
          <View style={[styles.rodape, { borderTopColor: colors.glassBorder }]}>
            <View style={styles.rodapeLinha}>
              <TouchableOpacity
                style={[
                  styles.botaoLimpar,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
                onPress={handleLimpar}
                activeOpacity={0.75}
                accessibilityLabel="Limpar todos os filtros"
              >
                <Icone nome="lixeira" tamanho={15} cor={colors.text} />
                <Text style={[styles.botaoLimparTexto, { color: colors.text }]}>
                  Limpar
                </Text>
              </TouchableOpacity>

              <View style={styles.botaoAplicar}>
                <CustomButton
                  title={contadorFiltros > 0 ? `Aplicar (${contadorFiltros})` : 'Aplicar filtros'}
                  icone="sucesso"
                  onPress={handleAplicar}
                  style={styles.botaoAplicarInterno}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  areaFechar: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  pegador: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitulo: {
    fontSize: 11.5,
    marginTop: 3,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudo: {
    paddingHorizontal: 22,
  },
  secao: {
    paddingVertical: 14,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 11,
  },
  secaoTitulo: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  opcoesCategoria: {
    gap: 8,
  },
  opcaoCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1,
  },
  opcaoIcone: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoCategoriaTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  opcoesAno: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  opcaoAno: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  opcaoAnoTexto: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 6,
    marginBottom: 18,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoTexto: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
  },
  rodape: {
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  rodapeLinha: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  botaoLimpar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 46,
  },
  botaoLimparTexto: {
    fontSize: 13,
    fontWeight: '600',
  },
  botaoAplicar: {
    flex: 1,
  },
  botaoAplicarInterno: {
    width: '100%',
  },
});
