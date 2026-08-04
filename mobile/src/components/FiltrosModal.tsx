// Modal de filtros avançados para busca.
// Permite filtrar por categoria, ano, país e gravadora.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';

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

const CATEGORIAS = [
  { valor: 'release_format', label: '📀 Formato de Lançamento' },
  { valor: 'mix_edit', label: '🎚️ Mixagem / Edição' },
  { valor: 'instrumental', label: '🎹 Instrumental' },
  { valor: 'playback', label: '🎤 Playback' },
];

const ANOS_POPULARES = [
  { valor: [2020, 2024], label: '2020-2024' },
  { valor: [2010, 2019], label: '2010-2019' },
  { valor: [2000, 2009], label: '2000-2009' },
  { valor: [1990, 1999], label: '1990-1999' },
  { valor: [1980, 1989], label: '1980-1989' },
  { valor: [1970, 1979], label: '1970-1979' },
];

export default function FiltrosModal({
  visivel,
  filtrosAtuais,
  onFechar,
  onAplicar,
  onLimpar,
}: Props): React.JSX.Element {
  const [filtros, setFiltros] = useState<Filtros>(filtrosAtuais);

  const selecionarCategoria = (categoria: string) => {
    setFiltros(prev => ({
      ...prev,
      categoria: prev.categoria === categoria ? undefined : categoria,
    }));
  };

  const selecionarAno = (anoMin: number, anoMax: number) => {
    const mesmoAno = filtros.anoMin === anoMin && filtros.anoMax === anoMax;
    setFiltros(prev => ({
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

  const contadorFiltros = Object.values(filtros).filter(v => v !== undefined).length;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent={true}
      onRequestClose={onFechar}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onFechar}>
              <Text style={styles.botaoCancelar}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.titulo}>Filtros</Text>
            <TouchableOpacity onPress={handleLimpar}>
              <Text style={styles.botaoLimpar}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.conteudo} showsVerticalScrollIndicator={false}>
            {/* Categoria */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Categoria</Text>
              <View style={styles.opcoes}>
                {CATEGORIAS.map(cat => {
                  const selecionado = filtros.categoria === cat.valor;
                  return (
                    <TouchableOpacity
                      key={cat.valor}
                      style={[styles.opcao, selecionado && styles.opcaoSelecionada]}
                      onPress={() => selecionarCategoria(cat.valor)}
                    >
                      <Text style={[styles.opcaoTexto, selecionado && styles.opcaoTextoSelecionado]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Ano de Lançamento */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Ano de Lançamento</Text>
              <View style={styles.opcoes}>
                {ANOS_POPULARES.map(ano => {
                  const selecionado = 
                    filtros.anoMin === ano.valor[0] && filtros.anoMax === ano.valor[1];
                  return (
                    <TouchableOpacity
                      key={ano.label}
                      style={[styles.opcaoAno, selecionado && styles.opcaoSelecionada]}
                      onPress={() => selecionarAno(ano.valor[0], ano.valor[1])}
                    >
                      <Text style={[styles.opcaoTexto, selecionado && styles.opcaoTextoSelecionado]}>
                        {ano.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Informação */}
            <View style={styles.info}>
              <Text style={styles.infoTexto}>
                💡 Os filtros são aplicados aos resultados da busca atual
              </Text>
            </View>
          </ScrollView>

          {/* Botão aplicar */}
          <View style={styles.rodape}>
            <TouchableOpacity style={styles.botaoAplicar} onPress={handleAplicar}>
              <Text style={styles.botaoAplicarTexto}>
                Aplicar {contadorFiltros > 0 && `(${contadorFiltros})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F0F1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  botaoCancelar: {
    fontSize: 15,
    color: '#8080A0',
  },
  botaoLimpar: {
    fontSize: 15,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: 20,
  },
  secao: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  secaoTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  opcoes: {
    gap: 8,
  },
  opcao: {
    padding: 14,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  opcaoSelecionada: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderColor: '#1DB954',
  },
  opcaoTexto: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  opcaoTextoSelecionado: {
    color: '#1DB954',
    fontWeight: '600',
  },
  opcaoAno: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1A1A2E',
    alignItems: 'center',
  },
  info: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
  },
  infoTexto: {
    fontSize: 12,
    color: '#8080A0',
    lineHeight: 18,
  },
  rodape: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
  },
  botaoAplicar: {
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  botaoAplicarTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
