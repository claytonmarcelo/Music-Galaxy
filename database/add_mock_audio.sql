-- Script para adicionar URLs de áudio mock para teste
-- Este script adiciona URLs de áudio de exemplo para testar o player

-- Criar tabela temporária para IDs
CREATE TEMPORARY TABLE temp_ids AS
SELECT id FROM releases LIMIT 5;

-- Atualizar primeiras 5 releases com URLs de áudio de teste
UPDATE releases r
JOIN temp_ids t ON r.id = t.id
SET 
  r.audio_preview_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  r.streaming_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  r.download_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

DROP TEMPORARY TABLE temp_ids;

-- Criar tabela temporária para IDs próximos
CREATE TEMPORARY TABLE temp_ids2 AS
SELECT id FROM releases LIMIT 5 OFFSET 5;

-- Atualizar próximas 5 releases
UPDATE releases r
JOIN temp_ids2 t ON r.id = t.id
SET 
  r.audio_preview_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  r.streaming_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  r.download_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3';

DROP TEMPORARY TABLE temp_ids2;

-- Criar tabela temporária para IDs de qualidade
CREATE TEMPORARY TABLE temp_ids3 AS
SELECT id FROM releases LIMIT 5 OFFSET 10;

-- Atualizar releases com áudio de qualidade diferente
UPDATE releases r
JOIN temp_ids3 t ON r.id = t.id
SET 
  r.audio_preview_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  r.streaming_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  r.download_url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  r.quality = '320kbps';

DROP TEMPORARY TABLE temp_ids3;

-- Nota: Estas URLs são de áudios de domínio público para testes
-- Em produção, estas URLs seriam substituídas por URLs reais das APIs de streaming
