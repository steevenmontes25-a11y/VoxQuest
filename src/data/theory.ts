/** Contenido de teoria musical: quizzes y glosario. */

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
  /** si tiene `earNotes`, se reproducen antes de responder (intervalo de oido). */
  earSemitones?: number;
}

export const QUIZ_SETS: Record<string, { title: string; questions: QuizQuestion[] }> = {
  basics: {
    title: "Fundamentos",
    questions: [
      {
        q: "¿Cuantas lineas tiene un pentagrama?",
        options: ["4", "5", "6", "7"],
        answer: 1,
        explain: "El pentagrama tiene 5 lineas y 4 espacios. 'Penta' = cinco."
      },
      {
        q: "¿Que figura dura la mitad que una negra?",
        options: ["Blanca", "Redonda", "Corchea", "Semicorchea"],
        answer: 2,
        explain: "La corchea vale 1/2 tiempo si la negra vale 1 tiempo."
      },
      {
        q: "En compas de 4/4, ¿cuantas negras entran por compas?",
        options: ["2", "3", "4", "8"],
        answer: 2,
        explain: "El 4 de arriba indica 4 pulsos; el 4 de abajo, que el pulso es una negra."
      },
      {
        q: "¿Cual es la nota mas grave?",
        options: ["Do central (C4)", "La 440 (A4)", "Do bajo (C3)", "Mi (E4)"],
        answer: 2,
        explain: "A menor numero de octava, sonido mas grave: C3 esta una octava debajo de C4."
      },
      {
        q: "El silencio equivalente a la negra se llama...",
        options: ["Silencio de redonda", "Silencio de blanca", "Silencio de negra", "Calderon"],
        answer: 2,
        explain: "Cada figura tiene su silencio de igual duracion."
      }
    ]
  },
  intervals: {
    title: "Intervalos de oido",
    questions: [
      { q: "¿Que intervalo escuchaste?", options: ["2M", "3M", "5J", "8J"], answer: 1, explain: "Tercera mayor = 4 semitonos (Do-Mi).", earSemitones: 4 },
      { q: "¿Que intervalo escuchaste?", options: ["3m", "4J", "5J", "6M"], answer: 2, explain: "Quinta justa = 7 semitonos (Do-Sol).", earSemitones: 7 },
      { q: "¿Que intervalo escuchaste?", options: ["2m", "2M", "3m", "4J"], answer: 1, explain: "Segunda mayor = 2 semitonos (Do-Re).", earSemitones: 2 },
      { q: "¿Que intervalo escuchaste?", options: ["6M", "7m", "7M", "8J"], answer: 3, explain: "Octava justa = 12 semitonos.", earSemitones: 12 },
      { q: "¿Que intervalo escuchaste?", options: ["3m", "3M", "4J", "TT"], answer: 0, explain: "Tercera menor = 3 semitonos (La-Do).", earSemitones: 3 }
    ]
  },
  keys: {
    title: "Tonalidades",
    questions: [
      { q: "¿Cuantos sostenidos tiene Sol mayor?", options: ["0", "1", "2", "3"], answer: 1, explain: "Sol mayor tiene 1 sostenido: Fa#." },
      { q: "La relativa menor de Do mayor es...", options: ["La menor", "Mi menor", "Re menor", "Sol menor"], answer: 0, explain: "La relativa menor esta una 3ra menor debajo: La menor." },
      { q: "En el circulo de quintas, ¿que sigue despues de Re?", options: ["Sol", "La", "Mi", "Si"], answer: 1, explain: "Subiendo quintas: Do-Sol-Re-La-Mi..." },
      { q: "¿Cuantos bemoles tiene Fa mayor?", options: ["0", "1", "2", "3"], answer: 1, explain: "Fa mayor tiene 1 bemol: Sib." },
      { q: "La escala mayor sigue el patron (T=tono, s=semitono)...", options: ["T-T-s-T-T-T-s", "T-s-T-T-s-T-T", "T-T-T-s-T-T-s", "s-T-T-T-s-T-T"], answer: 0, explain: "Mayor: T-T-s-T-T-T-s." }
    ]
  }
};

export interface GlossaryEntry {
  term: string;
  def: string;
  tags: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "Pentagrama", def: "Conjunto de 5 lineas y 4 espacios donde se escriben las notas.", tags: ["notacion"] },
  { term: "Clave de Sol", def: "Signo al inicio del pentagrama que fija Sol4 en la 2a linea. Usada por voces agudas e instrumentos altos.", tags: ["notacion"] },
  { term: "Negra", def: "Figura que suele valer 1 pulso en compases con denominador 4.", tags: ["ritmo"] },
  { term: "Corchea", def: "Figura que vale la mitad de una negra.", tags: ["ritmo"] },
  { term: "Compas", def: "Agrupacion regular de pulsos delimitada por barras. 4/4 = 4 negras por compas.", tags: ["ritmo"] },
  { term: "Intervalo", def: "Distancia en altura entre dos notas, medida en grados o semitonos.", tags: ["armonia", "oido"] },
  { term: "Tercera mayor", def: "Intervalo de 4 semitonos (Do-Mi). Suena alegre, base del acorde mayor.", tags: ["armonia", "oido"] },
  { term: "Quinta justa", def: "Intervalo de 7 semitonos (Do-Sol). Muy estable y consonante.", tags: ["armonia", "oido"] },
  { term: "Octava", def: "Intervalo de 12 semitonos. Las dos notas comparten nombre (Do-Do).", tags: ["armonia"] },
  { term: "Escala mayor", def: "Serie de 7 notas con patron T-T-s-T-T-T-s. Sonoridad brillante.", tags: ["escalas"] },
  { term: "Escala menor natural", def: "Patron T-s-T-T-s-T-T. Sonoridad mas oscura o melancolica.", tags: ["escalas"] },
  { term: "Pentatonica", def: "Escala de 5 notas, sin semitonos. Muy usada en folk, pop y blues.", tags: ["escalas"] },
  { term: "Tonalidad", def: "Sistema de relaciones alrededor de una nota central (tonica).", tags: ["armonia"] },
  { term: "Circulo de quintas", def: "Ordenamiento de las 12 tonalidades por quintas; predice las alteraciones de cada armadura.", tags: ["armonia"] },
  { term: "Cadencia", def: "Sucesion de acordes que crea sensacion de reposo o suspenso (p.ej. V-I).", tags: ["armonia"] },
  { term: "Cents", def: "Centesima parte de un semitono. 100 cents = 1 semitono. Se usa para medir afinacion fina.", tags: ["afinacion"] },
  { term: "Diafragma", def: "Musculo bajo los pulmones que controla la respiracion de apoyo al cantar.", tags: ["tecnica"] },
  { term: "Passaggio", def: "Zona de transicion entre registros vocales donde la voz tiende a 'quebrarse'.", tags: ["tecnica"] },
  { term: "Voz de pecho", def: "Registro grave, con resonancia sentida en el pecho.", tags: ["tecnica"] },
  { term: "Voz de cabeza", def: "Registro agudo, con resonancia sentida en la cabeza; incluye el falsete.", tags: ["tecnica"] },
  { term: "Vibrato", def: "Oscilacion periodica y controlada de la altura, tipicamente 5-7 Hz.", tags: ["tecnica"] },
  { term: "Formante", def: "Pico de resonancia del tracto vocal que define el timbre de cada vocal.", tags: ["tecnica", "acustica"] },
  { term: "Dinamica", def: "Grado de intensidad sonora (p, mf, f...).", tags: ["expresion"] },
  { term: "Articulacion", def: "Modo de ejecutar las notas: ligado, picado, acentuado.", tags: ["expresion"] }
];
