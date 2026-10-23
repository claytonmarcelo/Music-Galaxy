# Assets do Music Galaxy

Esta pasta contém os assets do aplicativo (ícones e splash screen).

## Arquivos atuais

- `icon.png` — Ícone principal do app (1024×1024), fundo transparente, com o mascote robô de fones segurando um disco de vinil, na paleta taupe, vinho e marfim.
- `adaptive-icon.png` — Primeiro plano do ícone adaptativo do Android (1024×1024, fundo transparente, arte reduzida à área segura).
- `splash.png` — Imagem da tela de abertura (mesma arte do ícone), exibida em modo "contain" sobre o fundo escuro `#1A1312` definido em `app.json`.
- `mascote.png` — Mascote do Music Galaxy, usado nas telas de busca, favoritos, fila de downloads e ajustes.

## Regras do ícone

- O ícone deve manter fundo transparente (sem caixa de cor de fundo).
- O ícone adaptativo usa `backgroundColor` `#201816` (token `background` do tema escuro) e o primeiro plano transparente.
- Nunca usar ícones gerados por IA como "oficiais" de conteúdo musical — o ícone do app é arte própria do produto, não capa de música (Regra 1 do AGENTS.md se aplica apenas a capas de obras).

## Como regenerar

Para atualizar os assets, substitua `icon.png`, `adaptive-icon.png` e `splash.png` por novas imagens PNG com fundo transparente, mantendo o mascote como centro da identidade.
