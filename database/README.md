# Music Galaxy - Banco de Dados MariaDB

## Configuração no WampServer64

### 1. Acessar o phpMyAdmin
- Abra o navegador e acesse: http://localhost/phpmyadmin
- Faça login com suas credenciais (geralmente root sem senha)

### 2. Criar o banco de dados
- Execute o script `schema.sql` (inclui schema completo e seeds)

### 3. Via linha de comando (alternativa)
```bash
# Acessar o MySQL/MariaDB
mysql -u root -p -P 3307

# Executar script completo (inclui schema e seeds)
source C:/wamp64/www/musicgalaxy/database/schema.sql
```

## Estrutura do Banco

### Tabelas Principais
- `artists` - Artistas/bandas responsáveis pelas obras musicais
- `works` - Obras musicais conceituais (a música em si, independente de versões)
- `releases` - Cada versão/lançamento específico de uma obra (coração da Regra 2)
- `release_types` - Catálogo fixo de formatos e tipos de versão
- `metadata_sources` - Fontes de metadados (Discogs, MusicBrainz, etc)

### Relacionamentos
- works → artists (N:1)
- releases → works (N:1)
- releases → release_types (N:1)
- releases → metadata_sources (N:1)

## Regras de Negócio Implementadas

### Regra 1 - Capa Oficial
- Campo `cover_url` só é preenchido quando a fonte fornece a capa oficial
- NULL quando não há capa disponível (exibir "Sem Capa" no frontend)
- Nunca gerar, criar ou substituir capas artificialmente

### Regra 2 - Pesquisa Completa
- Cada release é um registro independente (nenhuma versão substitui outra)
- Catálogo completo de 60+ tipos de release_types
- Suporta todas as categorias: release_format, mix_edit, instrumental, playback
- Cada versão tem seus próprios metadados completos

## Seeds Incluídos

O arquivo `schema.sql` inclui automaticamente:

### release_types (60+ tipos)
- **release_format**: Álbum, Single, EP, Maxi Single, Promo, White Label, Box Set, Deluxe Edition, Remastered, etc.
- **mix_edit**: Acapella, Karaoke, Radio Edit, Extended Mix, Club Mix, Remix, Dub Mix, VIP Mix, etc.
- **instrumental**: Instrumental Original, Instrumental Remix, Instrumental Extended, etc.
- **playback**: Playback Original, Playback Remix, Playback Extended, etc.

### metadata_sources
- Discogs
- MusicBrainz
- Manual

## Manutenção

### Backup
```bash
# Exportar banco de dados
mysqldump -u root -p -P 3307 musicgalaxy > backup_musicgalaxy.sql

# Importar backup
mysql -u root -p -P 3307 musicgalaxy < backup_musicgalaxy.sql
```

### Limpar banco (cuidado!)
```sql
DROP DATABASE musicgalaxy;
```

## Conexão com Backend

O backend deve conectar ao MariaDB usando:
- Host: localhost
- Porta: 3307 (configurar em backend/.env)
- Usuário: root (ou conforme configuração)
- Senha: (conforme configuração do WampServer64)
- Banco: musicgalaxy
