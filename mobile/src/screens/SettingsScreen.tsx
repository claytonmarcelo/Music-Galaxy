// Tela de ajustes do aplicativo.
// Reúne aparência, preferência de qualidade dos downloads, acesso à fila,
// endereço do servidor da API e informações do Music Galaxy. Toda a
// interface usa os tokens do tema e os componentes de vidro fosco.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { downloadManager } from '../services/downloadManager';
import {
  FormatoDownload,
  OPCOES_QUALIDADE,
  obterQualidadePadrao,
  salvarQualidadePadrao,
} from '../services/downloadRelease';
import {
  BASE_URL,
  configurarServidor,
  restaurarServidorPadrao,
  testarConexaoServidor,
} from '../services/api';
import CustomButton from '../components/CustomButton';
import FundoAtmosfera from '../components/FundoAtmosfera';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import SeletorTema, { Tema } from '../components/SeletorTema';
import { RootStackParamList } from '../types';
import { comAlfa } from '../utils/cores';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

// Mascote do Music Galaxy, exibido na seção "Sobre".
const MASCOTE = require('../../assets/mascote.png');

export default function SettingsScreen(): React.JSX.Element {
  const { theme, isDark, colors, setTheme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const { abrirErro, abrirAviso, toastSucesso, toastInfo } = useModal();

  const [qualidade, setQualidade] = useState<FormatoDownload>('mp3');
  const [resumo, setResumo] = useState({ total: 0, baixando: 0, concluidos: 0, erros: 0 });

  // Endereço do servidor exibido no campo — começa com o valor atual da API.
  const [urlServidor, setUrlServidor] = useState(BASE_URL);
  // Estados de carregamento dos botões da seção Servidor da API.
  const [salvandoServidor, setSalvandoServidor] = useState(false);
  const [testandoServidor, setTestandoServidor] = useState(false);

  const atualizarResumo = useCallback(() => {
    setResumo(downloadManager.obterContagem());
  }, []);

  // Relê preferência e contagens sempre que a tela ganha foco.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      void (async () => {
        await downloadManager.initialize();
        const preferida = await obterQualidadePadrao();
        if (ativo) {
          setQualidade(preferida);
          setResumo(downloadManager.obterContagem());
        }
      })();
      return () => {
        ativo = false;
      };
    }, [])
  );

  // Mantém as contagens vivas enquanto a tela está aberta.
  useEffect(() => downloadManager.assinarTodos(atualizarResumo), [atualizarResumo]);

  const escolherQualidade = async (formato: FormatoDownload) => {
    setQualidade(formato);
    await salvarQualidadePadrao(formato);
    toastSucesso(
      formato === 'flac'
        ? 'Qualidade padrão: FLAC sem perdas'
        : 'Qualidade padrão: MP3 320 kbps'
    );
  };

  // Salva o endereço informado e aplica nas próximas chamadas da API.
  const handleSalvarServidor = async () => {
    try {
      setSalvandoServidor(true);
      const normalizado = await configurarServidor(urlServidor);
      setUrlServidor(normalizado);
      toastSucesso('Endereço do servidor salvo!');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao salvar o servidor.';
      abrirErro('Não foi possível salvar', mensagem);
    } finally {
      setSalvandoServidor(false);
    }
  };

  // Testa se o endereço informado responde no endpoint de saúde.
  const handleTestarConexao = async () => {
    try {
      setTestandoServidor(true);
      const ok = await testarConexaoServidor(urlServidor);
      if (ok) {
        toastSucesso('Conexão bem-sucedida!');
      } else {
        abrirAviso(
          'Falha na conexão',
          'Não foi possível alcançar o servidor. Verifique o endereço e se o servidor está no ar.'
        );
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao testar a conexão.';
      abrirErro('Não foi possível testar a conexão', mensagem);
    } finally {
      setTestandoServidor(false);
    }
  };

  // Volta ao endereço padrão do ambiente.
  const handleRestaurarPadrao = async () => {
    try {
      const padrao = await restaurarServidorPadrao();
      setUrlServidor(padrao);
      toastInfo('Endereço padrão restaurado.');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao restaurar o padrão.';
      abrirErro('Não foi possível restaurar', mensagem);
    }
  };

  const descricaoTema = theme === 'auto'
    ? `Automático (${isDark ? 'escuro' : 'claro'} agora)`
    : theme === 'dark'
      ? 'Sempre escuro'
      : 'Sempre claro';

  // Texto do atalho da fila: prioriza o que está acontecendo agora.
  const descricaoFila = resumo.baixando > 0
    ? `${resumo.baixando} ${resumo.baixando === 1 ? 'download em andamento' : 'downloads em andamento'}`
    : resumo.erros > 0
      ? `${resumo.erros} ${resumo.erros === 1 ? 'download com erro' : 'downloads com erro'}`
      : resumo.total > 0
        ? `${resumo.total} ${resumo.total === 1 ? 'item na fila' : 'itens na fila'}`
        : 'Nenhum download ainda';

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.cabecalho}>
          <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>
            PREFERÊNCIAS DO APLICATIVO
          </Text>
          <Text style={[styles.titulo, { color: colors.text }]}>Ajustes</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Aparência */}
          <GlassCard style={styles.secao}>
            <SecaoTitulo icone="sol" titulo="Aparência" descricao={descricaoTema} />

            <View style={styles.temas}>
              <SeletorTema valor={theme} onChange={setTheme} />
            </View>
          </GlassCard>

          {/* Downloads */}
          <GlassCard style={styles.secao}>
            <SecaoTitulo
              icone="download"
              titulo="Downloads"
              descricao="A qualidade escolhida vale para o botão rápido de cada versão."
            />

            <View style={styles.qualidades}>
              {OPCOES_QUALIDADE.map((opcao) => {
                const selecionada = qualidade === opcao.formato;
                return (
                  <TouchableOpacity
                    key={opcao.formato}
                    style={[
                      styles.qualidadeOpcao,
                      {
                        backgroundColor: selecionada
                          ? comAlfa(colors.primary, 0.14)
                          : colors.glassCard,
                        borderColor: selecionada ? colors.primary : colors.glassBorder,
                      },
                    ]}
                    onPress={() => void escolherQualidade(opcao.formato)}
                    activeOpacity={0.75}
                    accessibilityState={{ selected: selecionada }}
                    accessibilityLabel={`Qualidade padrão ${opcao.titulo}`}
                  >
                    <View style={styles.qualidadeTopo}>
                      <Icone
                        nome={selecionada ? 'sucessoCirculo' : 'qualidade'}
                        tamanho={15}
                        cor={selecionada ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.qualidadeTitulo,
                          { color: selecionada ? colors.primary : colors.text },
                        ]}
                      >
                        {opcao.titulo}
                      </Text>
                    </View>
                    <Text style={[styles.qualidadeDescricao, { color: colors.textSecondary }]}>
                      {opcao.descricao}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.atalhoFila,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => navigation.navigate('FilaDownloads')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Abrir fila de downloads"
            >
              <View
                style={[
                  styles.atalhoIcone,
                  { backgroundColor: comAlfa(colors.primary, 0.14) },
                ]}
              >
                <Icone nome="fila" tamanho={17} cor={colors.primary} />
              </View>
              <View style={styles.atalhoTextos}>
                <Text style={[styles.atalhoTitulo, { color: colors.text }]}>
                  Fila de downloads
                </Text>
                <Text style={[styles.atalhoDescricao, { color: colors.textSecondary }]}>
                  {descricaoFila}
                </Text>
              </View>
              {resumo.baixando > 0 && (
                <View style={[styles.seloAtivo, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.seloAtivoTexto, { color: colors.buttonText }]}>
                    {resumo.baixando}
                  </Text>
                </View>
              )}
              <Icone nome="seta" tamanho={17} cor={colors.textSecondary} />
            </TouchableOpacity>
          </GlassCard>

          {/* Servidor da API */}
          <GlassCard style={styles.secao}>
            <SecaoTitulo
              icone="servidor"
              titulo="Servidor da API"
              descricao="Endereço que fornece o acervo. Em outra rede, ajuste aqui para o aplicativo funcionar."
            />

            <View
              style={[
                styles.campoServidor,
                { backgroundColor: colors.input, borderColor: colors.glassBorder },
              ]}
            >
              <Icone nome="servidor" tamanho={16} cor={colors.textSecondary} />
              <TextInput
                style={[styles.inputServidor, { color: colors.text }]}
                value={urlServidor}
                onChangeText={setUrlServidor}
                placeholder="http://exemplo.com:3001"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Endereço do servidor da API"
              />
            </View>

            <View style={styles.botoesLinha}>
              <View style={styles.botaoMetade}>
                <CustomButton
                  title="Salvar"
                  onPress={handleSalvarServidor}
                  variant="primary"
                  size="small"
                  icone="sucesso"
                  loading={salvandoServidor}
                  style={styles.botaoCheio}
                />
              </View>
              <View style={styles.botaoMetade}>
                <CustomButton
                  title="Testar conexão"
                  onPress={handleTestarConexao}
                  variant="secondary"
                  size="small"
                  icone="wifi"
                  loading={testandoServidor}
                  style={styles.botaoCheio}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.restaurar}
              onPress={handleRestaurarPadrao}
              activeOpacity={0.7}
              accessibilityLabel="Restaurar endereço padrão do servidor"
            >
              <Icone nome="recarregar" tamanho={13} cor={colors.primary} />
              <Text style={[styles.restaurarTexto, { color: colors.primary }]}>
                Restaurar endereço padrão
              </Text>
            </TouchableOpacity>
          </GlassCard>

          {/* Sobre */}
          <GlassCard style={styles.secao}>
            <SecaoTitulo icone="info" titulo="Sobre" descricao="Aplicativo de exploração musical" />

            <View style={styles.sobreLinha}>
              <View
                style={[
                  styles.mascoteMoldura,
                  { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
                ]}
              >
                <Image
                  source={MASCOTE}
                  style={styles.mascote}
                  resizeMode="cover"
                  accessibilityLabel="Mascote do Music Galaxy"
                />
              </View>

              <View style={styles.sobreTextos}>
                <Text style={[styles.sobreNome, { color: colors.text }]}>Music Galaxy</Text>
                <Text style={[styles.sobreVersao, { color: colors.textSecondary }]}>
                  Versão 1.0.0
                </Text>
                <Text style={[styles.sobreDescricao, { color: colors.textSecondary }]}>
                  Todas as versões de uma obra, com áudio de fontes abertas da web.
                </Text>
              </View>
            </View>

            <View style={[styles.sobreDivisor, { backgroundColor: colors.glassBorder }]} />

            {/* Desenvolvedor do projeto */}
            <View style={styles.desenvolvedorLinha}>
              <View
                style={[
                  styles.desenvolvedorIcone,
                  { backgroundColor: comAlfa(colors.primary, 0.13), borderColor: comAlfa(colors.primary, 0.24) },
                ]}
              >
                <Icone nome="artista" tamanho={16} cor={colors.primary} />
              </View>
              <View style={styles.desenvolvedorTextos}>
                <Text style={[styles.desenvolvedorTitulo, { color: colors.text }]}>
                  Desenvolvido por Clayton Marcelo
                </Text>
                <Text style={[styles.desenvolvedorTexto, { color: colors.textSecondary }]}>
                  Projeto idealizado e desenvolvido por Clayton Marcelo para reunir em um só
                  lugar todas as versões de uma obra — do single ao álbum — com o áudio
                  disponível em fontes abertas da web.
                </Text>
              </View>
            </View>

            <View style={[styles.sobreDivisor, { backgroundColor: colors.glassBorder }]} />

            <TouchableOpacity
              style={[
                styles.atalhoManual,
                { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
              ]}
              onPress={() => navigation.navigate('Manual')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Abrir o manual de uso do aplicativo"
            >
              <View
                style={[
                  styles.atalhoIcone,
                  { backgroundColor: comAlfa(colors.primary, 0.14) },
                ]}
              >
                <Icone nome="ajuda" tamanho={17} cor={colors.primary} />
              </View>
              <View style={styles.atalhoTextos}>
                <Text style={[styles.atalhoTitulo, { color: colors.text }]}>
                  Manual do aplicativo
                </Text>
                <Text style={[styles.atalhoDescricao, { color: colors.textSecondary }]}>
                  Passo a passo de tudo, em português simples.
                </Text>
              </View>
              <Icone nome="seta" tamanho={17} cor={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.sobreDivisor, { backgroundColor: colors.glassBorder }]} />

            <View style={styles.sobreRodape}>
              <Icone nome="escudo" tamanho={13} cor={colors.success} />
              <Text style={[styles.sobreRodapeTexto, { color: colors.textSecondary }]}>
                Somente fontes abertas · capas oficiais
              </Text>
            </View>
          </GlassCard>

          <Text style={[styles.rodape, { color: colors.textSecondary }]}>
            Music Galaxy · feito para explorar música em todos os formatos.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

// Título de seção com ícone, descrição opcional e linha de destaque.
function SecaoTitulo({
  icone,
  titulo,
  descricao,
}: {
  icone: NomeIcone;
  titulo: string;
  descricao?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.secaoTituloBloco}>
      <View style={styles.secaoTituloLinha}>
        <View
          style={[
            styles.secaoIcone,
            { backgroundColor: comAlfa(colors.primary, 0.13), borderColor: comAlfa(colors.primary, 0.24) },
          ]}
        >
          <Icone nome={icone} tamanho={15} cor={colors.primary} />
        </View>
        <Text style={[styles.secaoTitulo, { color: colors.text }]}>{titulo}</Text>
      </View>
      {!!descricao && (
        <Text style={[styles.secaoDescricao, { color: colors.textSecondary }]}>
          {descricao}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 22 : 8,
    paddingBottom: 6,
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
  scroll: {
    paddingTop: 10,
    paddingBottom: 130,
  },
  secao: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 26,
  },
  secaoTituloBloco: {
    marginBottom: 14,
  },
  secaoTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  secaoIcone: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  secaoDescricao: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 8,
  },
  temas: {
    marginTop: 2,
  },
  qualidades: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  qualidadeOpcao: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 5,
  },
  qualidadeTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualidadeTitulo: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  qualidadeDescricao: {
    fontSize: 9.5,
    lineHeight: 14,
  },
  atalhoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 18,
    borderWidth: 1,
  },
  atalhoIcone: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoTextos: {
    flex: 1,
  },
  atalhoTitulo: {
    fontSize: 13,
    fontWeight: '600',
  },
  atalhoDescricao: {
    fontSize: 10,
    marginTop: 2,
  },
  seloAtivo: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  seloAtivoTexto: {
    fontSize: 10,
    fontWeight: '800',
  },
  campoServidor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    minHeight: 48,
    marginBottom: 10,
  },
  inputServidor: {
    flex: 1,
    fontSize: 12.5,
    paddingVertical: 0,
  },
  botoesLinha: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoMetade: {
    flex: 1,
  },
  botaoCheio: {
    width: '100%',
  },
  restaurar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 13,
    paddingBottom: 2,
  },
  restaurarTexto: {
    fontSize: 11,
    fontWeight: '600',
  },
  sobreLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mascoteMoldura: {
    width: 74,
    height: 74,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  sobreTextos: {
    flex: 1,
  },
  sobreNome: {
    fontSize: 16,
    fontWeight: '800',
  },
  sobreVersao: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  sobreDescricao: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 5,
  },
  sobreDivisor: {
    height: 1,
    marginVertical: 13,
  },
  desenvolvedorLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  desenvolvedorIcone: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desenvolvedorTextos: {
    flex: 1,
  },
  desenvolvedorTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  desenvolvedorTexto: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  atalhoManual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 18,
    borderWidth: 1,
  },
  sobreRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sobreRodapeTexto: {
    fontSize: 10,
    fontWeight: '500',
  },
  rodape: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 30,
    marginTop: 2,
  },
});
