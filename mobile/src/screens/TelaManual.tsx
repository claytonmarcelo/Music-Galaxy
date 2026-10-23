// Manual de uso do Music Galaxy.
// Guia objetivo, em português do Brasil, para quem tem dificuldade em
// manusear o celular. Cada assunto é um cartão de vidro que abre e fecha,
// com passos curtos e numerados. O texto evita termos técnicos e explica
// o que fazer, onde tocar e o que esperar.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../types';
import GlassCard from '../components/GlassCard';
import Icone, { NomeIcone } from '../components/Icone';
import FundoAtmosfera from '../components/FundoAtmosfera';
import { comAlfa } from '../utils/cores';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Manual'>;

// Mascote do Music Galaxy, guia do usuário na abertura do manual.
const MASCOTE = require('../../assets/mascote.png');

// Um assunto do manual: título, ícone, resumo e os passos.
interface Assunto {
  id: string;
  titulo: string;
  icone: NomeIcone;
  resumo: string;
  passos: string[];
}

const ASSUNTOS: Assunto[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos',
    icone: 'relogio',
    resumo: 'O que o aplicativo faz em dois minutos.',
    passos: [
      'Ao abrir o aplicativo, uma apresentação de três segundos mostra o mascote. Toque em "Pular" se quiser ir direto.',
      'A barra no rodapé leva você às áreas principais: Busca, Biblioteca, Explorar, Favoritos e Ajustes.',
      'Para começar, toque no campo com a lupa e escreva o nome de um artista, de uma música ou de um álbum.',
    ],
  },
  {
    id: 'pesquisa',
    titulo: 'Como pesquisar',
    icone: 'busca',
    resumo: 'Encontrar todas as versões de uma obra.',
    passos: [
      'Escreva pelo menos três letras. O aplicativo espera um instante antes de pesquisar, para não gastar cota com palavras incompletas.',
      'Toque no ícone de ajustes (as barrinhas) ao lado do campo para filtrar por tipo de lançamento e por ano.',
      'Só aparecem versões que têm áudio disponível em fontes abertas da web. As que ainda estão sendo localizadas aparecem avisadas no alto da lista.',
      'Toque em uma versão para abrir a ficha completa, com capa oficial, dados do lançamento e o player.',
    ],
  },
  {
    id: 'reconhecer',
    titulo: 'Identificar a música pelo som',
    icone: 'microfone',
    resumo: 'Descobrir o que está tocando ao lado do aparelho.',
    passos: [
      'Toque no botão de microfone dentro do campo de busca. O aplicativo pede a permissão do microfone na primeira vez.',
      'Quando a contagem terminar, deixe a música tocar perto do aparelho por alguns segundos.',
      'O trecho capturado é enviado ao servidor do Music Galaxy e analisado por um serviço de reconhecimento. Ele não é gravado, não fica guardado e some do aparelho assim que a análise termina.',
      'Se a música for reconhecida, o nome aparece no painel. Toque em "Pesquisar no Music Galaxy" para ver todas as versões dela.',
      'Se o trecho não for reconhecido, o aplicativo avisa que não encontrou nada e o campo de busca continua vazio — nenhuma sugestão é inventada.',
      'Se a música tocada ainda não existir no catálogo, o aplicativo avisa isso e sugere buscar só pelo nome do artista.',
      'Se o servidor não estiver configurado ou sem acesso à internet, o painel explica o motivo e permite tentar de novo.',
    ],
  },
  {
    id: 'ouvir',
    titulo: 'Como ouvir',
    icone: 'fone',
    resumo: 'Tocar uma música sem baixar antes.',
    passos: [
      'Abra uma versão e toque em "Reproduzir". O áudio vem de sites abertos da web e é transmitido pela API do aplicativo.',
      'Use o botão de pausar e o controle de volume do próprio aparelho.',
      'A reprodução também fica registrada no histórico, dentro da aba Biblioteca.',
    ],
  },
  {
    id: 'baixar',
    titulo: 'Como baixar',
    icone: 'download',
    resumo: 'Guardar a música no celular.',
    passos: [
      'Na ficha da versão, escolha a qualidade: MP3 320 kbps ou FLAC sem perdas. Você pode definir a preferência em Ajustes.',
      'Toque em "Baixar". O progresso aparece no próprio cartão.',
      'A fila sobrevive ao fechamento do aplicativo. Para ver, toque no ícone de download no alto da busca ou em Ajustes → Fila de downloads.',
      'Para cancelar, tocar ou tentar de novo, use os botões de cada item da fila.',
    ],
  },
  {
    id: 'favoritos',
    titulo: 'Favoritos e playlists',
    icone: 'favorito',
    resumo: 'Guardar o que você gosta e organizar.',
    passos: [
      'Na ficha da versão, toque no coração para adicionar aos favoritos. Repita para remover.',
      'Na aba Biblioteca, abra "Playlists" e crie uma lista com um nome escolhido por você.',
      'Adicione versões às listas pelo botão de playlist que aparece na ficha de cada versão.',
      'As listas guardam a ordem em que você adicionou e nunca repetem a mesma versão.',
    ],
  },
  {
    id: 'historico',
    titulo: 'Histórico',
    icone: 'relogio',
    resumo: 'Voltar ao que você já procurou ou ouviu.',
    passos: [
      'A aba Biblioteca tem a seção "Histórico" com as últimas músicas reproduzidas e as últimas buscas.',
      'Toque em um item do histórico para pesquisar de novo.',
      'O botão "Limpar" apaga a lista depois de um pedido de confirmação.',
    ],
  },
  {
    id: 'explorar',
    titulo: 'Explorar e limpar a lista',
    icone: 'explorar',
    resumo: 'Ver lançamentos recentes e obras por década.',
    passos: [
      'A aba Explorar mostra as versões mais recentes e as obras agrupadas por década.',
      'O botão "Limpar" abre uma janela de confirmação: escolha "Limpar" para esvaziar a lista ou "Manter" para deixar como está.',
      'A lista limpa continua assim ao fechar e abrir o aplicativo. Para voltar a carregar as versões, toque em "Mostrar lista novamente".',
    ],
  },
  {
    id: 'tema',
    titulo: 'Aparência e tema',
    icone: 'sol',
    resumo: 'Trocar entre o tema claro e o escuro.',
    passos: [
      'No alto da tela de busca, o botão com o sol ou a lua troca o tema na hora.',
      'Em Ajustes → Aparência você escolhe entre Claro, Escuro e Sistema (que acompanha o próprio aparelho).',
    ],
  },
  {
    id: 'servidor',
    titulo: 'Endereço do servidor',
    icone: 'servidor',
    resumo: 'Quando o aplicativo não encontra nada.',
    passos: [
      'Em Ajustes → Servidor da API, confira o endereço informado. Em outro Wi-Fi ou na internet do celular, ele pode precisar ser trocado.',
      'Toque em "Testar conexão" para conferir se o endereço responde.',
      'Se você não usa outro endereço, toque em "Restaurar endereço padrão".',
      'Sem conexão, o aplicativo continua abrindo e avisa que está offline — a busca por texto fica disponível assim que a internet voltar.',
    ],
  },
  {
    id: 'instalar',
    titulo: 'Instalar o aplicativo no Android',
    icone: 'download',
    resumo: 'Instalar o arquivo APK no aparelho.',
    passos: [
      'O aplicativo funciona no Android 16 (versão de 2025) ou mais novo. Em Androids anteriores a instalação é recusada pelo próprio sistema, porque o aplicativo usa recursos dessas versões.',
      'Baixe o arquivo APK pelo navegador ou pelo link enviado a você.',
      'Ao abrir o arquivo, o Android pode avisar que o download veio de fora da loja. Toque em "Configurações" e autorize o navegador a instalar aplicativos.',
      'Volte ao aviso de instalação e toque em "Instalar". Espere a instalação terminar e abra o aplicativo pelo ícone que aparecer na tela inicial.',
      'Se o Android recusar a instalação, reinicie o aparelho e tente de novo. O aplicativo não altera o sistema: a instalação é sempre feita por você, na tela do próprio Android.',
    ],
  },
  {
    id: 'recusa',
    titulo: 'Quando a instalação é recusada',
    icone: 'escudo',
    resumo: 'Entender as recusas mais comuns e o que fazer.',
    passos: [
      'O aviso "não é compatível com seu aparelho" significa que o Android é anterior a 2025. Atualize o sistema em Configurações → Sistema → Atualização do sistema.',
      'O aviso "já existe um aplicativo com o mesmo nome" acontece quando a versão que está no aparelho foi assinada de outra forma. Desinstale a versão antiga — segure o ícone do aplicativo e toque em "Desinstalar" — e instale o arquivo novo.',
      'O aviso de falta de espaço pede memória livre no armazenamento do aparelho. Libere espaço e tente instalar de novo.',
      'Se o aplicativo abrir e mostrar um aviso sobre a versão do Android, siga as três telas de instrução que ele mesmo apresenta.',
      'Instalar por cima da versão anterior não apaga nada: favoritos, playlists, histórico e downloads continuam no aparelho.',
    ],
  },
  {
    id: 'atualizar',
    titulo: 'Atualizar o aplicativo',
    icone: 'recarregar',
    resumo: 'Receber uma versão mais nova.',
    passos: [
      'O aplicativo procura uma versão nova sozinho ao abrir. Para procurar na mão, vá em Ajustes → Sobre → "Procurar atualizações".',
      'Quando existe versão nova, aparece um aviso com o botão "Baixar". Toque nele para abrir a página de download no navegador do aparelho.',
      'Baixe o arquivo APK atualizado e instale por cima do aplicativo atual.',
      'Se o Android recusar a versão nova porque ela tem o mesmo número da anterior, desinstale a versão antiga primeiro. Cada versão publicada usa um número maior, justamente para que a atualização seja aceita.',
      'Seus favoritos, playlists, histórico e downloads continuam no aparelho depois da atualização.',
      'A atualização do aplicativo não muda a versão do Android do aparelho. Quando o sistema for atualizado, o aplicativo continua funcionando.',
    ],
  },
  {
    id: 'microfone',
    titulo: 'Permissão do microfone',
    icone: 'microfone',
    resumo: 'Autorizar o uso do microfone para identificar músicas.',
    passos: [
      'O microfone só é usado quando você toca no botão de identificar música. Nada é gravado em segundo plano.',
      'Na primeira vez, o Android pergunta se o aplicativo pode gravar. Toque em "Permitir".',
      'Para mudar depois: Configurações do Android → Aplicativos → Music Galaxy → Permissões → Microfone.',
      'A gravação é apagada assim que a identificação termina. O aplicativo não guarda nem envia as suas gravações para o banco de dados.',
      'Se você recusou a permissão, o painel avisa que o microfone está bloqueado. A busca por texto continua funcionando: só a identificação pelo som fica indisponível até você permitir.',
    ],
  },
  {
    id: 'problemas',
    titulo: 'Problemas comuns',
    icone: 'ajuda',
    resumo: 'Respostas rápidas para as dúvidas mais frequentes.',
    passos: [
      'Não ouço som: confira o volume do aparelho e toque em Reproduzir de novo. Se estiver nos favoritos, o aplicativo prefere o arquivo baixado.',
      'A busca não encontra nada: escreva o nome de outro jeito, com menos palavras, ou use os filtros para ampliar o período.',
      'Aparece "versão aguardando fonte de áudio": o aplicativo está procurando o áudio em sites abertos. É normal e resolve em alguns minutos.',
      'O aplicativo avisa que está sem internet: volte a conectar e puxe a tela para baixo para recarregar.',
      'A instalação foi recusada: veja o assunto "Quando a instalação é recusada" — o motivo mais comum é um Android anterior a 2025.',
    ],
  },
];

export default function TelaManual(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavProp>();

  // Controla quais assuntos estão abertos (começa tudo fechado).
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const alternar = (id: string) => {
    setAbertos((atual) => ({ ...atual, [id]: !atual[id] }));
  };

  return (
    <FundoAtmosfera>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.cabecalho}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={[
              styles.botaoVoltar,
              { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a tela anterior"
          >
            <Icone nome="voltar" tamanho={18} cor={colors.text} />
          </TouchableOpacity>

          <View style={styles.titulos}>
            <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>GUIA PRÁTICO</Text>
            <Text style={[styles.titulo, { color: colors.text }]}>Manual do aplicativo</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Apresentação do manual com o mascote */}
          <GlassCard style={styles.apresentacao}>
            <View style={styles.apresentacaoLinha}>
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
              <View style={styles.apresentacaoTextos}>
                <Text style={[styles.apresentacaoTitulo, { color: colors.text }]}>
                  Como usar o Music Galaxy
                </Text>
                <Text style={[styles.apresentacaoTexto, { color: colors.textSecondary }]}>
                  Toque em um assunto para abrir o passo a passo. Se preferir, leia tudo na
                  ordem — cada bloco é curto.
                </Text>
              </View>
            </View>
          </GlassCard>

          {ASSUNTOS.map((assunto) => {
            const aberto = !!abertos[assunto.id];
            return (
              <GlassCard key={assunto.id} style={styles.assunto}>
                <TouchableOpacity
                  onPress={() => alternar(assunto.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: aberto }}
                  accessibilityLabel={`${assunto.titulo}. ${assunto.resumo}`}
                  style={styles.assuntoCabecalho}
                >
                  <View
                    style={[
                      styles.assuntoIcone,
                      {
                        backgroundColor: comAlfa(colors.primary, 0.13),
                        borderColor: comAlfa(colors.primary, 0.24),
                      },
                    ]}
                  >
                    <Icone nome={assunto.icone} tamanho={16} cor={colors.primary} />
                  </View>

                  <View style={styles.assuntoTextos}>
                    <Text style={[styles.assuntoTitulo, { color: colors.text }]}>
                      {assunto.titulo}
                    </Text>
                    <Text style={[styles.assuntoResumo, { color: colors.textSecondary }]}>
                      {assunto.resumo}
                    </Text>
                  </View>

                  <Icone
                    nome={aberto ? 'setaBaixo' : 'seta'}
                    tamanho={17}
                    cor={colors.textSecondary}
                  />
                </TouchableOpacity>

                {aberto && (
                  <View style={styles.passos}>
                    <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />
                    {assunto.passos.map((passo, indice) => (
                      <View key={passo} style={styles.passoLinha}>
                        <View style={[styles.passoNumero, { backgroundColor: comAlfa(colors.primary, 0.16) }]}>
                          <Text style={[styles.passoNumeroTexto, { color: colors.primary }]}>
                            {indice + 1}
                          </Text>
                        </View>
                        <Text style={[styles.passoTexto, { color: colors.textSecondary }]}>
                          {passo}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </GlassCard>
            );
          })}

          <Text style={[styles.rodape, { color: colors.textSecondary }]}>
            Music Galaxy · fontes abertas, capas oficiais e todas as versões de uma obra.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </FundoAtmosfera>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  botaoVoltar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulos: {
    flex: 1,
  },
  etiqueta: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  scroll: {
    paddingTop: 10,
    paddingBottom: 130,
  },
  apresentacao: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 18,
    borderRadius: 26,
  },
  apresentacaoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mascoteMoldura: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  apresentacaoTextos: {
    flex: 1,
  },
  apresentacaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
  },
  apresentacaoTexto: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 5,
  },
  assunto: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 24,
  },
  assuntoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  assuntoIcone: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assuntoTextos: {
    flex: 1,
  },
  assuntoTitulo: {
    fontSize: 14,
    fontWeight: '700',
  },
  assuntoResumo: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  passos: {
    marginTop: 4,
  },
  divisor: {
    height: 1,
    marginVertical: 12,
  },
  passoLinha: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  passoNumero: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  passoNumeroTexto: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  passoTexto: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
  },
  rodape: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 30,
    marginTop: 6,
  },
});
