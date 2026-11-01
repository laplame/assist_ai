import { checadasDesde, leerConfig, listarColaboradores, type ChecadaLocal } from './db';

const etiquetas: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  pausa_inicio: 'Inicio de pausa',
  pausa_fin: 'Fin de pausa',
  comida_inicio: 'Inicio de comida',
  comida_fin: 'Fin de comida',
  correccion: 'Corrección',
};

export async function armarReporteDia(ahora = new Date()): Promise<string> {
  const sucursal = (await leerConfig('sucursal')) ?? 'Sucursal';
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  const [personas, checadas] = await Promise.all([listarColaboradores(), checadasDesde(inicio.getTime())]);
  const porPersona = new Map<string, ChecadaLocal[]>();
  for (const checada of checadas) {
    const lista = porPersona.get(checada.empleadoId) ?? [];
    lista.push(checada);
    porPersona.set(checada.empleadoId, lista);
  }
  const conocidos = new Set(personas.map((persona) => persona.id));
  const bloques = personas.map((persona) => bloque(persona.nombre, porPersona.get(persona.id) ?? []));
  for (const [empleadoId, eventos] of porPersona) {
    if (conocidos.has(empleadoId)) continue;
    bloques.push(bloque('Sin nombre', eventos));
  }
  const fecha = inicio.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cuerpo = bloques.length > 0 ? bloques.join('\n\n') : 'No hay colaboradores en este equipo.';
  return `assit-ai · ${sucursal}\nReporte del ${fecha}\n\n${cuerpo}`;
}

function bloque(nombre: string, eventos: ChecadaLocal[]): string {
  if (eventos.length === 0) return `${nombre}\nSin checadas`;
  const lineas = eventos.map((evento) => {
    const hora = new Date(evento.tsDispositivo).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return `${etiquetas[evento.tipo] ?? evento.tipo} ${hora}`;
  });
  return `${nombre}\n${lineas.join('\n')}`;
}
