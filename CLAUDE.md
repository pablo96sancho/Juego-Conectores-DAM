# Connector Poker

Juego educativo en forma de poker para aprender a identificar los conectores internos y externos de un ordenador. Proyecto en grupo del módulo **Sistemas Informáticos** (DAM, 1º, IES La Vereda).

Este archivo es la fuente de verdad del proyecto. Si algo de aquí contradice una suposición tuya, manda este archivo. Si falta información, pregunta antes de inventar.

## Contexto del enunciado

- Hay que diseñar y construir un juego que enseñe a identificar conectores internos y externos de un ordenador. Otro grupo lo probará en clase y debe salir sabiendo reconocer cada conector, para qué sirve y dónde va.
- Kahoot no vale: la mecánica tiene que ser de diseño propio. La mecánica debe obligar a pensar, no solo a memorizar nombres.
- Contenido mínimo: 10 conectores internos + 10 externos. Para cada uno, el juego trabaja tres datos: **nombre, función y ubicación**.
- Puntos extra: velocidades de las versiones de USB y conectores con forma "anti-error" (muescas, posiciones únicas).
- Entregables: el juego terminado (aquí, enlace a GitHub Pages), memoria de máximo 2 páginas (reparto de tareas, fuentes de imágenes e información, qué mejoraríamos) y presentación de 5 minutos con sesión de juego con otro grupo.
- El poker no está en los ejemplos del enunciado: el formato se ha propuesto y necesita el visto bueno del profesor.

## Qué estamos construyendo

Versión **web** de Connector Poker: 1 jugador humano contra 2-4 bots, partida de unos 10-15 minutos. Las mismas reglas se usan para una versión física (cartas impresas), cuyo manual está en `docs/connector-poker-reglas.pdf`.

## Stack y restricciones

- HTML + CSS + JavaScript puro (ES modules). **Sin frameworks, sin bundler, sin npm obligatorio.**
- Datos en `data/conectores.json`, cargados con `fetch`. Por eso se prueba con un servidor local, no abriendo el archivo directamente.
- Tests con el runner nativo de Node (`node --test`), solo para la lógica pura (`hands.js`, `deck.js`).
- Publicación gratuita en GitHub Pages (rama `main`, carpeta raíz).
- `localStorage` solo para guardar el ranking local.
- Sin dinero real: solo fichas virtuales.

### Comandos

```bash
python3 -m http.server 8000    # servir el juego en http://localhost:8000
node --test tests/             # ejecutar los tests de la lógica
```

### Estructura prevista

```
connector-poker/
├── CLAUDE.md
├── index.html
├── css/style.css
├── js/
│   ├── main.js        # arranque y conexión con la UI
│   ├── deck.js        # carga el JSON y construye la baraja de 90 cartas
│   ├── hands.js       # evaluateHand(cards) -> { rank, mainConnectorId, ... }
│   ├── game.js        # estado de la partida, rondas, apuestas, fichas
│   ├── bots.js        # IA sencilla de los bots
│   └── showdown.js    # genera y corrige los retos de justificación
├── data/conectores.json
├── assets/img/        # una foto por conector + CREDITS.md
├── tests/hands.test.js
└── docs/              # reglas en PDF y memoria
```

## Convenciones

- Interfaz y textos del juego en **español**. Identificadores de código en **inglés**. Comentarios en español.
- Términos técnicos se mantienen en inglés si así se estudian (por ejemplo "showdown", "socket", "pinout").
- Funciones pequeñas y puras en `hands.js` y `deck.js`: sin acceso al DOM, para poder testearlas.
- Un commit por funcionalidad, con mensaje en español.
- Antes de un cambio grande, explica el plan en pocas líneas y espera confirmación.
- Accesibilidad básica: contraste suficiente, controles usables con teclado, texto alternativo en las imágenes.

## Modelo de datos

`data/conectores.json` es un array de objetos con esta forma:

```json
{
  "id": 4,
  "nombre": "SATA datos",
  "tipo": "interno",
  "funcion": "Datos de discos HDD/SSD",
  "ubicacion": "Placa base ↔ disco",
  "antiError": "Conector con forma de L que solo entra en una posición",
  "imagen": "assets/img/sata-datos.jpg"
}
```

`id` (1-20) sirve también como **prioridad** en los desempates.

### Los 20 conectores

| id | Nombre | Tipo | Función | Ubicación |
|---|---|---|---|---|
| 1 | ATX 24 pines | interno | Alimentación de la placa base | Placa base ← fuente |
| 2 | EPS 4+4 pines | interno | Alimentación de la CPU | Placa base ← fuente |
| 3 | PCIe 6+2 pines | interno | Alimentación de la tarjeta gráfica | Gráfica ← fuente |
| 4 | SATA datos | interno | Datos de discos HDD/SSD | Placa base ↔ disco |
| 5 | SATA alimentación | interno | Alimentación de discos | Disco ← fuente |
| 6 | M.2 | interno | SSD NVMe/SATA, tarjetas wifi | Placa base |
| 7 | Ranura PCIe x16 / x1 | interno | Tarjetas de expansión | Placa base |
| 8 | Ranura DIMM | interno | Módulos de memoria RAM | Placa base |
| 9 | Socket CPU | interno | Procesador | Placa base |
| 10 | Panel frontal (F_PANEL) | interno | Botón de encendido, reset, LEDs | Placa base |
| 11 | USB-A (2.0 / 3.x) | externo | Periféricos y almacenamiento | Panel trasero/frontal |
| 12 | USB-C | externo | Datos, vídeo y carga | Panel trasero/frontal |
| 13 | HDMI | externo | Vídeo y audio digital | Placa base o gráfica |
| 14 | DisplayPort | externo | Vídeo digital de alta resolución | Placa base o gráfica |
| 15 | VGA | externo | Vídeo analógico (antiguo) | Panel trasero |
| 16 | DVI | externo | Vídeo digital/analógico (antiguo) | Panel trasero |
| 17 | RJ45 | externo | Red Ethernet | Panel trasero |
| 18 | Jack 3,5 mm | externo | Audio: salida, micrófono, línea | Panel trasero/frontal |
| 19 | PS/2 | externo | Teclado y ratón (antiguo) | Panel trasero |
| 20 | IEC C13/C14 | externo | Alimentación eléctrica de la fuente | Fuente |

### Campo `antiError` (puntos extra)

| id | Característica anti-error |
|---|---|
| 1 | Carcasa asimétrica con clip de bloqueo: solo entra en una posición |
| 2 | Carcasa con formas asimétricas y clip de bloqueo |
| 3 | Carcasa asimétrica con clip; el módulo "+2" se separa para usar 6 pines |
| 4 | Forma de L |
| 5 | Forma de L (más ancho que el de datos) |
| 6 | Muesca (key B, M o B+M) que limita en qué ranuras entra |
| 7 | Muesca a un lado que impide insertar la tarjeta al revés |
| 8 | Muesca descentrada y clips laterales; cada generación DDR cambia la posición de la muesca |
| 9 | Triángulo de alineación en una esquina y muescas asimétricas |
| 10 | Cabecera con un pin ausente (key) y cables etiquetados con polaridad |
| 11 | Rectangular y no reversible: solo entra en una posición |
| 12 | Reversible (simétrico 180°): no necesita orientación |
| 13 | Forma de trapecio con dos esquinas achaflanadas |
| 14 | Una esquina cortada (achaflanada) |
| 15 | Forma de D con tornillos de sujeción |
| 16 | Forma de D con tornillos y pin plano distintivo |
| 17 | Pestaña de plástico (clip) y forma asimétrica |
| 18 | Sin muesca: se evita el error con el código de colores (verde salida, rosa micrófono, azul línea) |
| 19 | Mini-DIN con guía y código de colores (violeta teclado, verde ratón) |
| 20 | Forma trapezoidal asimétrica; C13 es la hembra del cable y C14 el macho de la fuente |

### Velocidades USB (comodín USB)

| Versión | Velocidad |
|---|---|
| USB 2.0 | 480 Mbps |
| USB 3.2 Gen 1 (antes 3.0) | 5 Gbps |
| USB 3.2 Gen 2 (antes 3.1) | 10 Gbps |
| USB 3.2 Gen 2x2 | 20 Gbps |
| USB4 | 40 Gbps |
| USB4 versión 2.0 (opcional) | 80 Gbps |

## Reglas del juego

### La baraja: 90 cartas

- **80 cartas de conector:** 4 por conector, una de cada tipo: **Foto, Nombre, Función, Ubicación**. No hay dos cartas iguales del mismo conector.
- **6 cartas Trampa:** función ambigua que encaja con dos conectores parecidos. Pares: HDMI/DisplayPort, VGA/DVI, USB-A/USB-C, SATA datos/M.2, ATX 24/EPS 4+4, PCIe 6+2/EPS 4+4.
- **2 comodines USB** y **2 comodines Anti-error**.

### Desarrollo de una mano

1. Cada jugador empieza con 20 fichas y paga 1 de ante al bote.
2. Se reparten 5 cartas a cada jugador.
3. Primera ronda de apuestas: pasar, apostar (máximo 2 fichas), igualar o retirarse. Máximo una subida por jugador y ronda.
4. Cada jugador puede cambiar hasta 3 cartas con el mazo.
5. Segunda ronda de apuestas.
6. Showdown con justificación (ver más abajo). Quien gana se lleva el bote.

### Ranking de manos (de menor a mayor)

Se agrupa por conector (cartas del mismo conector, sea cual sea su tipo). Un grupo puede tener como máximo 4 cartas.

| Rango | Mano | Patrón de grupos |
|---|---|---|
| 0 | Carta alta | 1-1-1-1-1 |
| 1 | Pareja | 2-1-1-1 |
| 2 | Doble pareja | 2-2-1 |
| 3 | Trío | 3-1-1 |
| 4 | Full | 3-2 |
| 5 | Póker | 4-1 |
| 6 | Escalera de energía | Las cartas **Nombre** de: IEC C13/C14, ATX 24 pines, EPS 4+4 pines, PCIe 6+2 pines y SATA alimentación |

### Desempates

Gana el rango más alto. Si empatan, se compara el `id` del conector del grupo principal (en doble pareja, primero la pareja mayor y luego la menor), después las cartas sueltas de mayor a menor `id`. Si sigue el empate, se reparte el bote.

### Cartas especiales

- **Trampa:** cuenta como carta de **Función** de cualquiera de los dos conectores de su par. Para que cuente en el showdown hay que explicar la diferencia entre ambos conectores.
- **Comodín USB:** sustituye a cualquier carta de USB-A o USB-C. Para usarlo hay que decir la velocidad de la versión de USB que se pregunte.
- **Comodín Anti-error:** sustituye a cualquier carta de un conector interno (ids 1 a 10). Para usarlo hay que explicar su característica anti-error.
- Máximo **una** carta especial cuenta por mano. Las demás se tratan como cartas sin valor.

### Showdown con justificación

Quien tiene la mejor mano debe superar un reto antes de cobrar:

- **Digital:** 2 preguntas tipo test (3 opciones) sobre los conectores de su combinación. Ejemplos: "¿Cuál es la función de X?", "¿Dónde va X?". Los distractores se sacan de conectores parecidos (mismo tipo o misma ubicación). Si usa una carta especial, se pregunta la diferencia entre los dos conectores, la velocidad USB o la característica anti-error.
- **Si falla:** pierde 2 fichas (van al bote) y el reto pasa al siguiente mejor jugador. Si nadie lo supera, el bote se acumula a la mano siguiente.
- **Bots:** superan el reto con probabilidad configurable (por defecto 0,8).

## Plan de trabajo por capas

Entregar siempre algo que funcione. No empezar una fase sin cerrar la anterior.

1. **Fase 0, base:** repositorio, `index.html`, `data/conectores.json` con los 20 conectores y fotos libres con `CREDITS.md` (autor, licencia, URL).
2. **Fase 1, lógica:** `deck.js` y `hands.js` con tests. Cubrir los 7 rangos, desempates, Trampa y comodines. Modo práctica: se reparten 5 cartas y se muestra qué mano forman.
3. **Fase 2, partida:** `game.js`, apuestas, cambio de cartas y showdown con retos contra 2 bots.
4. **Fase 3, extras:** comodines y Trampa en la UI, retos de velocidades USB y anti-error, ranking local, ayuda con el ranking de manos.
5. **Fase 4, pulido:** diseño responsive, accesibilidad, pruebas con compañeros, despliegue en GitHub Pages y capturas para la memoria.

## Criterios de aceptación

- [ ] 20 conectores (10 internos y 10 externos) con nombre, función y ubicación.
- [ ] Se puede jugar una partida completa contra bots sin errores en consola.
- [ ] El ranking de manos pasa los tests, incluidos desempates y cartas especiales.
- [ ] El showdown exige justificar la mano y penaliza el fallo.
- [ ] Extras: velocidades USB y anti-error presentes.
- [ ] Todas las imágenes tienen autor y licencia en `assets/img/CREDITS.md`.
- [ ] Funciona en el navegador del aula y en móvil.

## No hacer

- No usar dinero real ni lenguaje de apuestas reales: son fichas de un juego educativo.
- No copiar imágenes con copyright ni cartas de barajas comerciales.
- No añadir frameworks ni dependencias sin consultar al grupo.
- No dar por buena una imagen sin registrar su fuente y licencia.
- No cambiar las reglas de este archivo sin avisar: el PDF y la memoria deben seguir coincidiendo.
