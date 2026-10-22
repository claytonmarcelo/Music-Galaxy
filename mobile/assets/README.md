# Assets do Music Galaxy

Esta pasta contém os assets do aplicativo (ícones e splash screen).

## Arquivos atuais

- `icon.png` — Ícone principal do app (1024×1024), fundo transparente, símbolo de música em vidro com aurora e o nome "Music Galaxy" em tipografia elegante.
- `splash.png` — Imagem da tela de abertura (mesma arte do ícone), exibida em modo "contain" sobre o fundo escuro `#0B0B1A` definido em `app.json`.

## Regras do ícone

- O ícone deve manter fundo transparente (sem caixa de cor de fundo).
- Nunca usar ícones gerados por IA como "oficiais" de conteúdo musical — o ícone do app é arte própria do produto, não capa de música (Regra 1 do AGENTS.md se aplica apenas a capas de obras).

## Como regenerar

O antigo script `generate-assets.js` (criador de placeholders provisórios) foi removido — ele substituiria o ícone atual por um quadrado verde. Para atualizar os assets, basta substituir `icon.png` e `splash.png` por novas imagens PNG com fundo transparente.
