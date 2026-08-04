// Controle de taxa de requisições para APIs externas.
// MusicBrainz permite 1 requisição por segundo por IP.
// Discogs permite 60 requisições por minuto com token (autenticado).
// Este módulo garante que nunca ultrapassemos esses limites.

// Fila simples para serializar as chamadas a uma fonte específica.
// Cada fonte tem seu próprio controlador de taxa independente.

interface ControladorTaxa {
  ultimaChamada: number;        // Timestamp da última requisição realizada
  intervaloMinimoMs: number;    // Intervalo mínimo obrigatório entre chamadas
  fila: Array<() => void>;      // Fila de callbacks aguardando liberação
  processando: boolean;         // Indica se a fila está sendo processada
}

// Mapa de controladores por nome de fonte
const controladores: Map<string, ControladorTaxa> = new Map();

// Inicializa ou retorna o controlador para uma fonte específica.
function obterControlador(nomeSource: string): ControladorTaxa {
  if (!controladores.has(nomeSource)) {
    const intervalo = calcularIntervalo(nomeSource);
    controladores.set(nomeSource, {
      ultimaChamada: 0,
      intervaloMinimoMs: intervalo,
      fila: [],
      processando: false,
    });
  }
  return controladores.get(nomeSource)!;
}

// Define o intervalo mínimo entre chamadas por fonte.
function calcularIntervalo(nomeSource: string): number {
  const nome = nomeSource.toLowerCase();
  if (nome.includes('musicbrainz') || nome.includes('cover art')) {
    return 1100; // 1 segundo + margem de segurança (MusicBrainz: 1 req/s)
  }
  if (nome.includes('discogs')) {
    return 1000; // 1 segundo (60 req/min = 1 req/segundo)
  }
  return 1000; // Padrão conservador para fontes desconhecidas
}

// Processa a fila de forma assíncrona, respeitando o intervalo entre chamadas.
async function processarFila(controlador: ControladorTaxa): Promise<void> {
  if (controlador.processando) return;
  controlador.processando = true;

  while (controlador.fila.length > 0) {
    const agora = Date.now();
    const tempoDesdeUltima = agora - controlador.ultimaChamada;
    const espera = controlador.intervaloMinimoMs - tempoDesdeUltima;

    if (espera > 0) {
      await aguardar(espera);
    }

    const callback = controlador.fila.shift();
    if (callback) {
      controlador.ultimaChamada = Date.now();
      callback();
    }
  }

  controlador.processando = false;
}

// Aguarda um número de milissegundos antes de continuar.
function aguardar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Agenda uma chamada para ser executada respeitando o rate limit da fonte.
// Retorna uma Promise que resolve quando for a vez desta chamada na fila.
export function agendarChamada(nomeSource: string): Promise<void> {
  const controlador = obterControlador(nomeSource);

  return new Promise(resolve => {
    controlador.fila.push(resolve);
    processarFila(controlador);
  });
}

// Retorna o tamanho atual da fila de uma fonte.
export function tamanhoFila(nomeSource: string): number {
  const controlador = controladores.get(nomeSource);
  return controlador?.fila.length ?? 0;
}
