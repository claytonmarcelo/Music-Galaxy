// Faixa de aviso de modo offline — aparece quando o servidor da API não
// está acessível. Permite abrir o aplicativo sem internet e explica, de
// forma clara, como corrigir. Fica logo acima da barra de navegação.

import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { BASE_URL, verificarSaude } from '../services/api';
import Icone from './Icone';
import { comAlfa } from '../utils/cores';

interface OfflineBannerProps {
  onAbrirAjustes?: () => void;
}

export default function OfflineBanner({ onAbrirAjustes }: OfflineBannerProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [naoConfigurado, setNaoConfigurado] = useState(false);
  const verificandoRef = useRef<boolean>(false);

  // Consulta o servidor uma única vez por ciclo de vida; o estado muda
  // apenas quando o aplicativo volta ao primeiro plano.
  const verificar = async () => {
    if (verificandoRef.current) return;
    verificandoRef.current = true;
    try {
      if (!BASE_URL) {
        setNaoConfigurado(true);
        setOffline(false);
        return;
      }
      setNaoConfigurado(false);
      const saudavel = await verificarSaude();
      setOffline(!saudavel);
    } finally {
      verificandoRef.current = false;
    }
  };

  useEffect(() => {
    verificar();
    const inscricao = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') {
        verificar();
      }
    });
    return () => {
      inscricao.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline && !naoConfigurado) {
    return null;
  }

  const corDestaque = naoConfigurado ? colors.warning : colors.error;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: insets.bottom + 84 }]}
    >
      <View
        style={[
          styles.faixa,
          {
            backgroundColor: colors.glassCardForte,
            borderColor: comAlfa(corDestaque, 0.3),
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View
          style={[
            styles.iconeCirculo,
            {
              backgroundColor: comAlfa(corDestaque, 0.16),
              borderColor: comAlfa(corDestaque, 0.32),
            },
          ]}
        >
          <Icone nome="wifiOff" tamanho={16} cor={corDestaque} />
        </View>

        <Text style={[styles.texto, { color: colors.text }]}>
          {naoConfigurado
            ? 'Servidor não configurado. Informe o endereço da API em Ajustes.'
            : 'Sem conexão com o servidor. O conteúdo pode estar desatualizado.'}
        </Text>

        {onAbrirAjustes && (
          <TouchableOpacity
            style={[styles.botao, { backgroundColor: colors.button }]}
            onPress={onAbrirAjustes}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Abrir ajustes do servidor"
          >
            <Text style={[styles.textoBotao, { color: colors.buttonText }]}>Ajustes</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9000,
  },

  faixa: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },

  iconeCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  texto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  botao: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoBotao: {
    fontSize: 12,
    fontWeight: '600',
  },
});
