// Componente de Filtros Avançados.
// Modal para filtrar releases por país, gravadora, qualidade, ano e tipo.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';

import { Release } from '../types';

// Interface para filtros
export interface FiltrosState {
  pais?: string | null;
  gravadora?: string | null;
  qualidade?: string | null;
  anoMin?: number | null;
  anoMax?: number | null;
  tipos?: string[];
}

interface Props {
  visivel: boolean;
  releases: Release[];
  onFechar: () => void;
  onAplicarFiltros: (filtros: FiltrosState) => void;
}

// Tipos únicos de releases disponiveis
const TIPOS_DISPONIVEIS = [
  'Album',
  'Single',
  'EP',
  'Maxi Single',
  'Promo',
  'Remix',
  'Mix',
  'Instrumental',
  'Live',
];

// Qualidades disponíveis
const QUALIDADES_DISPONIVEIS = [
  '320kbps',
  '192kbps',
  '128kbps',
  'FLAC',
  'WAV',
  'AAC',
  'OGG',
];

export default function FiltrosAvancados({
  visivel,
  releases,
  onFechar,
  onAplicarFiltros,
}: Props): React.JSX.Element {
  // Estados dos filtros
  const [paisSelecionado, setPaisSelecionado] = useState<string | null>(null);
  const [gravadoraBusca, setGravadoraBusca] = useState('');
  const [qualidadeSelecionada, setQualidadeSelecionada] = useState<string | null>(null);
  const [anoMin, setAnoMin] = useState<string>('');
  const [anoMax, setAnoMax] = useState<string>('');
  const [tiposEscolhidos, setTiposEscolhidos] = useState<Set<string>>(new Set());

  // Extrai dados únicos dos releases
  const extrairDados = useCallback(() => {
    const paises = new Set<string>();
    const gravadoras = new Set<string>();

    releases.forEach(rel => {
      if (rel.country) paises.add(rel.country);
      if (rel.label) gravadoras.add(rel.label);
    });

    return {
      paises: Array.from(paises).sort(),
      gravadoras: Array.from(gravadoras).sort(),
    };
  }, [releases]);

  const { paises, gravadoras } = extrairDados();

  // Togla seleção de tipo
  const handleToggleTipo = (tipo: string): void => {
    const novoSet = new Set(tiposEscolhidos);
    if (novoSet.has(tipo)) {
      novoSet.delete(tipo);
    } else {
      novoSet.add(tipo);
    }
    setTiposEscolhidos(novoSet);
  };

  // Aplica filtros
  const handleAplicarFiltros = (): void => {
    onAplicarFiltros({
      pais: paisSelecionado,
      gravadora: gravadoraBusca || null,
      qualidade: qualidadeSelecionada,
      anoMin: anoMin ? parseInt(anoMin, 10) : null,
      anoMax: anoMax ? parseInt(anoMax, 10) : null,
      tipos: Array.from(tiposEscolhidos),
    });
    onFechar();
  };

  // Reseta todos os filtros
  const handleResetarFiltros = (): void => {
    setPaisSelecionado(null);
    setGravadoraBusca('');
    setQualidadeSelecionada(null);
    setAnoMin('');
    setAnoMax('');
    setTiposEscolhidos(new Set());
  };

  // Renderiza item de país
  const renderPaisItem = (pais: string): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.itemLista,
        paisSelecionado === pais && styles.itemSelecionado,
      ]}
      onPress={() => setPaisSelecionado(paisSelecionado === pais ? null : pais)}
    >
      <View style={styles.checkbox}>
        {paisSelecionado === pais && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
      <Text
        style={[
          styles.textoItem,
          paisSelecionado === pais && styles.textoItemSelecionado,
        ]}
      >
        {pais}
      </Text>
    </TouchableOpacity>
  );

  // Renderiza item de gravadora
  const renderGravadoraItem = (gravadora: string): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.itemLista,
        gravadoraBusca === gravadora && styles.itemSelecionado,
      ]}
      onPress={() => setGravadoraBusca(gravadoraBusca === gravadora ? '' : gravadora)}
    >
      <View style={styles.checkbox}>
        {gravadoraBusca === gravadora && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
      <Text
        style={[
          styles.textoItem,
          gravadoraBusca === gravadora && styles.textoItemSelecionado,
        ]}
        numberOfLines={1}
      >
        {gravadora}
      </Text>
    </TouchableOpacity>
  );

  // Renderiza item de qualidade
  const renderQualidadeItem = (qualidade: string): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.itemLista,
        qualidadeSelecionada === qualidade && styles.itemSelecionado,
      ]}
      onPress={() => setQualidadeSelecionada(qualidadeSelecionada === qualidade ? null : qualidade)}
    >
      <View style={styles.checkbox}>
        {qualidadeSelecionada === qualidade && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
      <Text
        style={[
          styles.textoItem,
          qualidadeSelecionada === qualidade && styles.textoItemSelecionado,
        ]}
      >
        {qualidade}
      </Text>
    </TouchableOpacity>
  );

  // Renderiza item de tipo
  const renderTipoItem = (tipo: string): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.badgeTipo,
        tiposEscolhidos.has(tipo) && styles.badgeTipoSelecionado,
      ]}
      onPress={() => handleToggleTipo(tipo)}
    >
      <Text
        style={[
          styles.textoTipo,
          tiposEscolhidos.has(tipo) && styles.textoTipoSelecionado,
        ]}
      >
        {tipo}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
    >
      <View style={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onFechar}>
            <Text style={styles.botaoFechar}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Filtros Avançados</Text>
          <TouchableOpacity onPress={handleResetarFiltros}>
            <Text style={styles.botaoReset}>Resetar</Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo */}
        <ScrollView style={styles.conteudo} showsVerticalScrollIndicator={false}>
          {/* Filtro por País */}
          <View style={styles.secaoFiltro}>
            <Text style={styles.tituloFiltro}>🌍 País</Text>
            {paises.length > 0 ? (
              <FlatList
                scrollEnabled={false}
                data={paises}
                keyExtractor={(item, idx) => `pais-${idx}`}
                renderItem={({ item }) => renderPaisItem(item)}
              />
            ) : (
              <Text style={styles.textoVazio}>Nenhum país encontrado</Text>
            )}
          </View>

          {/* Filtro por Gravadora */}
          <View style={styles.secaoFiltro}>
            <Text style={styles.tituloFiltro}>🎵 Gravadora / Label</Text>
            <TextInput
              style={styles.inputBusca}
              placeholder="Buscar gravadora..."
              placeholderTextColor="#666666"
              value={gravadoraBusca}
              onChangeText={setGravadoraBusca}
            />
            {gravadoras.length > 0 ? (
              <FlatList
                scrollEnabled={false}
                data={gravadoras.filter(g =>
                  g.toLowerCase().includes(gravadoraBusca.toLowerCase())
                )}
                keyExtractor={(item, idx) => `gravadora-${idx}`}
                renderItem={({ item }) => renderGravadoraItem(item)}
              />
            ) : (
              <Text style={styles.textoVazio}>Nenhuma gravadora encontrada</Text>
            )}
          </View>

          {/* Filtro por Qualidade */}
          <View style={styles.secaoFiltro}>
            <Text style={styles.tituloFiltro}>🔊 Qualidade de Áudio</Text>
            <FlatList
              scrollEnabled={false}
              data={QUALIDADES_DISPONIVEIS}
              keyExtractor={(item, idx) => `qualidade-${idx}`}
              renderItem={({ item }) => renderQualidadeItem(item)}
            />
          </View>

          {/* Filtro por Ano */}
          <View style={styles.secaoFiltro}>
            <Text style={styles.tituloFiltro}>📅 Ano de Lançamento</Text>
            <View style={styles.containerAnos}>
              <View style={styles.inputAnoContainer}>
                <Text style={styles.labelAno}>De</Text>
                <TextInput
                  style={styles.inputAno}
                  placeholder="YYYY"
                  placeholderTextColor="#666666"
                  value={anoMin}
                  onChangeText={setAnoMin}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={styles.inputAnoContainer}>
                <Text style={styles.labelAno}>Até</Text>
                <TextInput
                  style={styles.inputAno}
                  placeholder="YYYY"
                  placeholderTextColor="#666666"
                  value={anoMax}
                  onChangeText={setAnoMax}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Filtro por Tipo */}
          <View style={styles.secaoFiltro}>
            <Text style={styles.tituloFiltro}>🏷️ Tipo de Release</Text>
            <View style={styles.containerTipos}>
              {TIPOS_DISPONIVEIS.map((tipo, idx) =>
                renderTipoItem(tipo)
              )}
            </View>
          </View>

          {/* Espaço extra */}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Rodapé com botões */}
        <View style={styles.rodape}>
          <TouchableOpacity style={styles.botaoCancel} onPress={onFechar}>
            <Text style={styles.textoCancel}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoAplicar} onPress={handleAplicarFiltros}>
            <Text style={styles.textoAplicar}>Aplicar Filtros</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    paddingTop: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  titulo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },

  botaoFechar: {
    color: '#FF6B35',
    fontSize: 24,
    fontWeight: 'bold',
  },

  botaoReset: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: 'bold',
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  secaoFiltro: {
    marginBottom: 24,
  },

  tituloFiltro: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  itemLista: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 6,
    marginBottom: 8,
  },

  itemSelecionado: {
    backgroundColor: '#FF6B3520',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  checkmark: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
  },

  textoItem: {
    color: '#AAAAAA',
    fontSize: 13,
    flex: 1,
  },

  textoItemSelecionado: {
    color: '#FF6B35',
    fontWeight: '600',
  },

  inputBusca: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2E2E4E',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
  },

  containerAnos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  inputAnoContainer: {
    flex: 1,
    marginHorizontal: 6,
  },

  labelAno: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },

  inputAno: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2E2E4E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },

  containerTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  badgeTipo: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2E2E4E',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },

  badgeTipoSelecionado: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },

  textoTipo: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
  },

  textoTipoSelecionado: {
    color: '#FFFFFF',
  },

  textoVazio: {
    color: '#AAAAAA',
    fontSize: 13,
    fontStyle: 'italic',
  },

  rodape: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderTopWidth: 1,
    borderTopColor: '#2E2E4E',
  },

  botaoCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoCancel: {
    color: '#FF6B35',
    fontWeight: 'bold',
    fontSize: 14,
  },

  botaoAplicar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoAplicar: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
