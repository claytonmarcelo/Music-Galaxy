// Faixa de aviso de modo offline — aparece quando o servidor da API não
// está acessível. Permite que o aplicativo seja aberto normalmente sem
// internet e avisa o usuário de forma clara, com orientação de correção.

import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { BASE_URL, verificarSaude } from '../services/api';

interface OfflineBannerProps {
  onAbrirAjustes?: () => void;
}

export default function OfflineBanner({ onAbrirAjustes }: OfflineBannerProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const [offline, setOffline] = useState(false);
  const [naoConfigurado, setNaoConfigurado] = useState(false);
  const verificarRef = useRef<boolean>(false);

  // Consulta o servidor uma única vez por ciclo de vida; o estado muda
  // apenas quando o aplicativo volta ao primeiro plano.
  const verificar = async () => {
    if (verificarRef.current) return;
    verificarRef.current = true;
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
      verificarRef.current = false;
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

  return (
    <View
      style={[
        styles.faixa,
        {
          backgroundColor: colors.glassCardForte,
          borderColor: naoConfigurado ? colors.warning : colors.error,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
      <Text style={[styles.texto, { color: colors.text }]}>
        {naoConfigurado
          ? 'Servidor não configurado. Informe o endereço da API em Ajustes.'
          : 'Sem conexão com o servidor. O conteúdo pode estar desatualizado.'}
      </Text>
      {onAbrirAjustes && (
        <TouchableOpacity onPress={onAbrirAjustes} activeOpacity={0.7}>
          <Text style={[styles.botao, { color: colors.primary }]}>Ajustes</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9000,
  },
  texto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  botao: {
    fontSize: 12,
    fontWeight: '700',
  },
});
