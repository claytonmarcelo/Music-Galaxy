# REGRAS MESTRAS OBRIGATÓRIAS — MUSIC GALAXY
## Identidade Visual Original + Premium Gourmet + Segurança e Privacidade + GitHub em Português Brasileiro

Estas regras complementam a especificação técnica e a auditoria do projeto Music Galaxy. Devem ser respeitadas durante análises, implementações, refatorações, correções, testes, auditorias e manutenções futuras.

# 1. PRESERVAÇÃO DA IDENTIDADE VISUAL ORIGINAL

## 1.1. Regra inviolável

A identidade visual original do Music Galaxy deve ser preservada como referência principal e obrigatória.

Antes de modificar qualquer interface, examine o projeto existente e identifique:

- Logotipo original, variações e aplicações.
- Paleta de cores existente.
- Tipografia e hierarquia visual.
- Elementos gráficos e identidade musical.
- Estrutura das telas e padrões de navegação.
- Componentes reutilizáveis e sistema de temas.
- Animações, ícones, espaçamentos e padrões de interação.
- Tema claro, tema escuro e preferências já existentes.
- Responsividade e comportamento nos diferentes dispositivos.

Não substitua, descaracterize ou descarte esses elementos para aplicar um novo estilo.

## 1.2. Aplicação do padrão Premium Gourmet

O padrão Premium Gourmet deve ser aplicado como uma evolução visual sofisticada da identidade existente, e não como uma nova identidade que substitua a original.

Objetivos:

- Aparência premium, refinada e profissional.
- Composição visual coerente com música e descoberta musical.
- Hierarquia tipográfica clara.
- Superfícies, profundidade, transparências e efeitos visuais usados com moderação.
- Animações fluidas, sem prejudicar desempenho ou acessibilidade.
- Ícones consistentes e componentes visualmente harmonizados.
- Estados de carregamento, vazio, sucesso, erro e indisponibilidade bem projetados.
- Experiência responsiva em diferentes tamanhos de tela.
- Contraste, legibilidade e acessibilidade adequados.
- Consistência entre telas, modais, menus, formulários e resultados de busca.

O resultado deve transmitir qualidade premium sem transformar o aplicativo em um template genérico ou em uma interface visualmente exagerada.

## 1.3. Restrições de design

É proibido, sem autorização explícita:

- Trocar o logotipo original.
- Alterar arbitrariamente a paleta institucional.
- Remover elementos visuais que caracterizam o Music Galaxy.
- Reescrever telas inteiras quando uma alteração localizada for suficiente.
- Introduzir um segundo sistema de design incompatível com o existente.
- Usar cores fixas que entrem em conflito com o sistema de temas já implementado.
- Remover funcionalidades para simplificar a interface.
- Modificar a identidade visual como consequência não planejada de uma refatoração técnica.

Priorize os componentes e tokens existentes. Se uma alteração de identidade parecer necessária, apresente a justificativa e aguarde autorização.

# 2. SEGURANÇA DA APLICAÇÃO E PROTEÇÃO DOS DADOS

## 2.1. Objetivo e responsabilidade

Trate segurança e privacidade como requisitos obrigatórios desde a concepção até a distribuição e manutenção do projeto.

O objetivo é reduzir de forma sistemática os riscos de invasão, acesso indevido, exposição de credenciais, vazamento de dados, abuso de APIs, comprometimento do banco de dados e execução de operações não autorizadas.

Nenhuma solução pode garantir risco zero ou invulnerabilidade absoluta. Portanto, implemente controles em camadas, valide sua eficácia e documente os riscos residuais.

## 2.2. Auditoria de segurança antes das alterações

Antes de implementar ou modificar funcionalidades:

1. Examine a arquitetura real do aplicativo, backend, banco de dados e integrações externas.
2. Identifique entradas não confiáveis, endpoints públicos, operações privilegiadas e fluxos de dados sensíveis.
3. Localize credenciais, tokens, chaves privadas, segredos, configurações de produção e arquivos potencialmente sensíveis.
4. Analise autenticação, autorização, sessões, validação de entrada e tratamento de erros.
5. Verifique dependências vulneráveis e configurações inseguras.
6. Identifique riscos de SQL injection, exposição de dados, acesso indevido entre usuários, SSRF, abuso de requisições e falhas de controle de acesso, conforme aplicável.
7. Avalie os riscos específicos de captura, transmissão e processamento de áudio.
8. Registre os achados por gravidade, evidência, impacto e prioridade de correção.

Não declare que uma vulnerabilidade inexiste apenas porque uma busca textual não encontrou ocorrências.

## 2.3. Proteção de credenciais e segredos

- Nunca incorporar tokens privados, senhas, chaves secretas ou credenciais administrativas ao código distribuído no aplicativo móvel.
- Nunca presumir que variáveis de ambiente utilizadas no aplicativo cliente são secretas.
- Manter segredos de serviços externos no backend, sempre que a arquitetura e o serviço permitirem.
- Utilizar variáveis de ambiente e mecanismos apropriados de gestão de segredos no ambiente de execução.
- Não registrar credenciais em logs, mensagens de erro, capturas de tela ou relatórios.
- Verificar se arquivos `.env`, certificados, chaves e configurações sensíveis estão excluídos do Git conforme necessário.
- Tratar rotação de credenciais e revogação de chaves expostas como procedimentos de segurança.
- Não copiar segredos reais para testes, documentação, exemplos ou commits.
- Se um segredo tiver sido exposto no histórico do Git, avaliar sua revogação imediata e o tratamento seguro do histórico.

A simples remoção de uma credencial do arquivo atual não neutraliza uma chave que já tenha sido publicada.

## 2.4. Autenticação, autorização e controle de acesso

- Aplicar autenticação adequada aos recursos que exigem identificação do usuário.
- Implementar autorização no servidor, não apenas ocultar botões ou telas no aplicativo.
- Verificar permissões em cada operação protegida.
- Impedir que um usuário consulte ou altere dados pertencentes a outro usuário sem autorização.
- Validar a propriedade dos recursos e o contexto de cada solicitação.
- Proteger operações administrativas e rotas sensíveis.
- Utilizar sessões ou tokens com validação, expiração e revogação apropriadas à arquitetura.
- Evitar mecanismos de autenticação simulados ou verificações que apenas aparentem segurança.
- Aplicar proteção contra abuso, força bruta e repetição de requisições conforme o risco.

Não introduza um novo sistema de autenticação sem analisar primeiro o mecanismo existente e sua compatibilidade.

## 2.5. API, backend e banco de dados

Para Node.js, Express e MariaDB, conforme aplicável:

- Utilizar consultas parametrizadas para impedir SQL injection.
- Validar e normalizar dados recebidos de clientes e serviços externos.
- Definir limites de tamanho, paginação, tempo de execução e frequência das requisições.
- Aplicar tratamento centralizado de erros sem revelar stack traces, consultas, caminhos internos ou informações sensíveis em produção.
- Configurar CORS de acordo com as origens realmente necessárias.
- Aplicar HTTPS nos ambientes de produção.
- Evitar permissões excessivas para usuários e serviços do banco de dados.
- Restringir o acesso de rede ao MariaDB.
- Não expor portas administrativas ou de banco de dados desnecessariamente.
- Garantir que operações críticas e alterações de dados sejam autorizadas e consistentes.
- Avaliar transações, concorrência, integridade referencial e prevenção de duplicidades quando aplicáveis.
- Proteger endpoints contra abuso, enumeração indevida de recursos e vazamento de informações.
- Revisar uploads, URLs externas e operações que possam permitir acesso a recursos internos.

Não altere o esquema do banco ou apague dados para corrigir problemas sem análise de impacto, plano de migração e autorização quando necessária.

## 2.6. Segurança específica do reconhecimento sonoro

- Solicitar acesso ao microfone somente quando necessário.
- Explicar claramente a finalidade da captura de áudio.
- Interromper a captura quando a operação terminar ou for cancelada.
- Não manter gravações persistentes por padrão.
- Transmitir somente os dados estritamente necessários ao serviço de reconhecimento.
- Não armazenar áudio, assinaturas, resultados ou identificadores pessoais além do necessário e autorizado.
- Verificar os termos, a política de privacidade e as condições de retenção do fornecedor externo.
- Manter credenciais privadas do fornecedor no backend quando aplicável.
- Aplicar limites de requisições, timeouts e controles de custos.
- Validar as respostas externas antes de apresentá-las ou persistir informações.
- Tratar indisponibilidade, respostas inválidas e falhas de autenticação sem expor detalhes internos.
- Evitar que logs, ferramentas de monitoramento ou relatórios capturem áudio ou dados pessoais desnecessários.

A utilização de assinaturas acústicas não elimina automaticamente todas as obrigações de privacidade. Avalie o fluxo real de dados e as condições do fornecedor escolhido.

## 2.7. Prevenção de vazamentos e monitoramento

- Registrar eventos relevantes de segurança sem registrar segredos ou conteúdo sensível desnecessário.
- Proteger o acesso aos logs.
- Não retornar informações internas em respostas públicas.
- Configurar corretamente os ambientes de desenvolvimento, teste e produção.
- Evitar dados reais de usuários em ambientes de teste quando não forem necessários.
- Definir procedimentos para incidentes, revogação de credenciais e recuperação.
- Verificar backups e restringir o acesso aos dados armazenados.
- Avaliar retenção, descarte e recuperação segura de dados.
- Manter dependências atualizadas de maneira controlada, testando a compatibilidade antes de atualizar.

# 3. PRIVACIDADE E MINIMIZAÇÃO DE DADOS

Colete, processe e retenha somente os dados necessários para as funcionalidades previstas.

Antes de introduzir uma nova forma de coleta ou armazenamento, documente:

- Quais dados são tratados.
- Por que são necessários.
- Onde são processados.
- Quem pode acessá-los.
- Se são enviados a terceiros.
- Por quanto tempo são mantidos.
- Como são removidos ou anonimizados, quando aplicável.
- Quais controles de segurança os protegem.

Não introduza telemetria invasiva, rastreamento desnecessário ou compartilhamento de dados com terceiros sem justificativa técnica e análise de privacidade.

# 4. PRESERVAÇÃO DA ARQUITETURA E PREVENÇÃO DE REGRESSÕES

- Preserve as tecnologias existentes e a arquitetura aprovada.
- Não introduza tecnologias adicionais sem necessidade comprovada e autorização.
- Não substitua módulos funcionais apenas por preferência pessoal.
- Não remova arquivos ou funcionalidades sem autorização explícita.
- Não altere regras de negócio sem avaliar os impactos.
- Realize alterações localizadas e justificadas.
- Execute testes relevantes após cada correção.
- Verifique a integração entre aplicativo, backend, serviços externos e banco de dados.
- Investigue regressões antes de considerar o trabalho concluído.
- Registre limitações reais e não apresente hipóteses como fatos comprovados.

# 5. COMUNICAÇÃO OBRIGATORIAMENTE EM PORTUGUÊS BRASILEIRO

A IDE deve se comunicar com o usuário exclusivamente em português brasileiro, de forma clara, profissional e objetiva.

Esta regra vale para:

- Planejamento e análise.
- Perguntas e pedidos de autorização.
- Relatórios técnicos.
- Explicações de erros.
- Mensagens de progresso.
- Resultados de testes.
- Auditorias de segurança.
- Relatórios de implementação.
- Resumos de alterações.
- Instruções de execução.
- Mensagens de commit.
- Documentação destinada ao usuário.
- Conclusões e pendências.

Não apresente relatórios ou explicações em inglês quando puder comunicá-los em português brasileiro.

Os identificadores obrigatórios de linguagens, APIs, bibliotecas, comandos, nomes de arquivos e termos técnicos podem permanecer no idioma original quando necessário para preservar a exatidão técnica.

Não traduza identificadores de código, nomes oficiais de APIs ou comandos executáveis de maneira que os torne inválidos.

Se uma ferramenta externa retornar mensagens em inglês, explique seu significado em português brasileiro.

# 6. GIT E GITHUB — HISTÓRICO HUMANIZADO EM PT-BR

## 6.1. Commits obrigatoriamente em português brasileiro

Todo commit criado pelo trabalho da IDE deve ter uma mensagem humanizada, clara e informativa, em português brasileiro.

A mensagem deve explicar a alteração real realizada, sem exagerar seu alcance ou declarar resultados que não foram comprovados.

Exemplos de mensagens adequadas:

- `feat: adiciona identificação musical pelo microfone`
- `fix: corrige falha no tratamento de permissões de áudio`
- `security: protege credenciais do serviço de reconhecimento`
- `test: adiciona testes para identificação de músicas`
- `refactor: organiza integração com o serviço de reconhecimento`
- `docs: documenta configuração e segurança do reconhecimento sonoro`
- `style: aprimora a interface premium sem alterar a identidade visual`
- `build: ajusta configuração de compilação do Android`

Os prefixos convencionais podem ser utilizados, mas a descrição deve permanecer em português brasileiro.

## 6.2. Condições antes de criar um commit

Antes de criar qualquer commit:

1. Examine `git status`.
2. Revise o diff completo das alterações.
3. Identifique arquivos novos, removidos, renomeados e modificados.
4. Procure segredos, tokens, credenciais, dados pessoais e arquivos de ambiente.
5. Confirme que nenhuma alteração não autorizada foi incluída.
6. Execute os testes pertinentes.
7. Verifique os resultados reais dos testes.
8. Prepare uma mensagem de commit que descreva fielmente as mudanças.

Não inclua arquivos sensíveis, dependências geradas desnecessariamente, artefatos locais ou alterações alheias ao trabalho.

Não apague arquivos nem descarte alterações preexistentes do usuário para limpar o repositório.

## 6.3. Commit, push e transparência

Quando o usuário autorizar o envio ao GitHub:

- Crie commits coerentes e pequenos quando isso facilitar a revisão.
- Use mensagens humanizadas em português brasileiro.
- Confira a branch de destino e o estado do repositório remoto.
- Preserve alterações preexistentes do usuário.
- Não force push, reescreva histórico compartilhado ou sobrescreva trabalho remoto sem autorização explícita.
- Após o push, confirme o resultado fornecido pelo Git.
- Informe branch, hash do commit, resumo das alterações e testes executados.

Não afirme que criou um commit ou enviou alterações ao GitHub sem confirmação efetiva da ferramenta utilizada.

Se os testes críticos falharem, não apresente o trabalho como pronto para produção. Informe a falha e solicite decisão antes de publicar uma alteração potencialmente insegura ou quebrada.

# 7. RELATÓRIO DE ENCERRAMENTO OBRIGATÓRIO

Ao concluir cada tarefa, apresente um relatório em português brasileiro contendo:

1. O que foi implementado ou corrigido.
2. Como a identidade visual original foi preservada.
3. Quais aprimoramentos Premium Gourmet foram realizados.
4. Quais controles de segurança foram implementados ou revisados.
5. Quais arquivos foram alterados.
6. Quais testes foram executados e seus resultados.
7. Quais testes não puderam ser executados.
8. Quais riscos ou pendências continuam abertos.
9. Se houve alterações no banco de dados, na arquitetura ou nas dependências.
10. O estado do Git e do GitHub, quando aplicável.
11. O hash do commit e a branch, quando efetivamente criados.
12. O que ainda precisa de validação manual ou em dispositivo físico.

Classifique cada item relevante como aprovado, reprovado, bloqueado ou não testado, conforme as evidências disponíveis.

# 8. CRITÉRIO FINAL

A identidade visual original deve continuar reconhecível. O padrão Premium Gourmet deve aprimorar sua apresentação, sem descaracterizá-la.

A segurança deve ser tratada como um processo contínuo de prevenção, validação, monitoramento e correção. Nenhum relatório pode prometer proteção absoluta contra qualquer invasão ou vazamento.

Toda comunicação da IDE com o usuário deve ser em português brasileiro.

Todo commit criado pela IDE deve possuir mensagem humanizada em português brasileiro.

A tarefa só pode ser declarada concluída após a apresentação de evidências verificáveis, testes pertinentes e pendências explicitamente documentadas.

**Preservar a identidade. Aprimorar sem descaracterizar. Proteger os dados. Validar antes de concluir. Comunicar em português brasileiro. Registrar o trabalho no GitHub com transparência.**
