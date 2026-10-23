// Ícones de linha do aplicativo.
// Um único componente traduz nomes em português para os conjuntos
// Feather (traços finos) e Material Community (símbolos preenchidos),
// mantendo peso, cor e alinhamento consistentes em todas as telas.

import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

type NomeFeather = React.ComponentProps<typeof Feather>['name'];
type NomeMaterial = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type DefinicaoIcone =
  | { familia: 'feather'; nome: NomeFeather }
  | { familia: 'material'; nome: NomeMaterial };

const ICONES = {
  busca: { familia: 'feather', nome: 'search' },
  limpar: { familia: 'feather', nome: 'x' },
  filtro: { familia: 'feather', nome: 'sliders' },
  favorito: { familia: 'feather', nome: 'heart' },
  favoritoCheio: { familia: 'material', nome: 'heart' },
  biblioteca: { familia: 'feather', nome: 'book-open' },
  explorar: { familia: 'feather', nome: 'compass' },
  ajustes: { familia: 'feather', nome: 'settings' },
  fila: { familia: 'feather', nome: 'list' },
  download: { familia: 'feather', nome: 'download' },
  reproduzir: { familia: 'feather', nome: 'play' },
  pausar: { familia: 'feather', nome: 'pause' },
  parar: { familia: 'feather', nome: 'square' },
  relogio: { familia: 'feather', nome: 'clock' },
  estatisticas: { familia: 'feather', nome: 'bar-chart-2' },
  voltar: { familia: 'feather', nome: 'arrow-left' },
  avancar: { familia: 'feather', nome: 'arrow-right' },
  seta: { familia: 'feather', nome: 'chevron-right' },
  setaBaixo: { familia: 'feather', nome: 'chevron-down' },
  musica: { familia: 'feather', nome: 'music' },
  artista: { familia: 'feather', nome: 'user' },
  playlist: { familia: 'feather', nome: 'list' },
  album: { familia: 'feather', nome: 'disc' },
  calendario: { familia: 'feather', nome: 'calendar' },
  pais: { familia: 'feather', nome: 'globe' },
  qualidade: { familia: 'feather', nome: 'aperture' },
  sucesso: { familia: 'feather', nome: 'check' },
  sucessoCirculo: { familia: 'feather', nome: 'check-circle' },
  erro: { familia: 'feather', nome: 'alert-circle' },
  aviso: { familia: 'feather', nome: 'alert-triangle' },
  info: { familia: 'feather', nome: 'info' },
  ajuda: { familia: 'feather', nome: 'help-circle' },
  sol: { familia: 'feather', nome: 'sun' },
  lua: { familia: 'feather', nome: 'moon' },
  sistema: { familia: 'feather', nome: 'monitor' },
  servidor: { familia: 'feather', nome: 'server' },
  pasta: { familia: 'feather', nome: 'folder' },
  lixeira: { familia: 'feather', nome: 'trash-2' },
  recarregar: { familia: 'feather', nome: 'refresh-cw' },
  banco: { familia: 'feather', nome: 'database' },
  fone: { familia: 'feather', nome: 'headphones' },
  ondas: { familia: 'feather', nome: 'radio' },
  wifi: { familia: 'feather', nome: 'wifi' },
  wifiOff: { familia: 'feather', nome: 'wifi-off' },
  escudo: { familia: 'feather', nome: 'shield' },
  lapis: { familia: 'feather', nome: 'edit-2' },
  playCirculo: { familia: 'feather', nome: 'play-circle' },
  pauseCirculo: { familia: 'feather', nome: 'pause-circle' },
  stopCirculo: { familia: 'feather', nome: 'stop-circle' },
  mais: { familia: 'feather', nome: 'plus' },
  menos: { familia: 'feather', nome: 'minus' },
} as const satisfies Record<string, DefinicaoIcone>;

export type NomeIcone = keyof typeof ICONES;

interface IconeProps {
  nome: NomeIcone;
  tamanho?: number;
  cor?: string;
  estilo?: StyleProp<TextStyle>;
}

export default function Icone({
  nome,
  tamanho = 20,
  cor,
  estilo,
}: IconeProps): React.JSX.Element {
  const { colors } = useTheme();
  const definicao: DefinicaoIcone = ICONES[nome];
  const corFinal = cor ?? colors.icon;

  if (definicao.familia === 'material') {
    return (
      <MaterialCommunityIcons
        name={definicao.nome}
        size={tamanho}
        color={corFinal}
        style={estilo}
      />
    );
  }

  return (
    <Feather
      name={definicao.nome}
      size={tamanho}
      color={corFinal}
      style={estilo}
    />
  );
}
