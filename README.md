# NOTAK · Notas

App web de escritorio para llevar las notas del grado: asignaturas, evaluaciones con peso, calculadora de nota necesaria, **convocatorias de varios tipos** (ordinaria, extraordinaria, gracia/tribunal, adelantada, mejora de nota) con historial por año, calendario de exámenes, estadísticas y pantalla de bloqueo con reloj y fecha.

Sin servidor ni dependencias: HTML, CSS y JavaScript puro. Los datos se guardan **solo en tu navegador** (`localStorage`).

## Usarla

- Local: abre `index.html` en el navegador.
- Web: en el repositorio, *Settings → Pages → Deploy from a branch → `main` / root*. Quedará en `https://<usuario>.github.io/notas/`.

El código de acceso inicial es **1159** (se cambia en Ajustes → Seguridad).

## Subir tu archivo

En **Ajustes → Importar notas** (o arrastrándolo) acepta:

- `NOTAK.xlsx`: el Excel de notas (hoja «Notas»). Crea asignaturas, créditos, curso, evaluaciones y ordinaria/extraordinaria.
- `Calificaciones.json`: la exportación de la app anterior del iPhone. Importa asignaturas, convocatorias por año, evaluaciones y fechas de examen; el resultado de cada convocatoria (aprobada/suspendida/en curso) se deduce de las notas.
- `.json` de NOTAK: copia de seguridad descargada desde la propia app (Ajustes → Datos).

También puedes exportar un `.csv` con todas las convocatorias para abrirlo en Excel.

## Secciones

| Sección | Qué hace |
|---|---|
| Inicio | Reloj, fecha, mini calendario, media, créditos, próximos exámenes y progreso |
| Asignaturas | Lista por curso + detalle con pestañas por convocatoria, tabla de notas y calculadora |
| Calendario | Mes completo con exámenes (de cada convocatoria) y eventos propios |
| Estadísticas | Notas finales, distribución, créditos por curso, convocatorias por tipo |
| Ajustes | Importar/exportar, código, bloqueo automático, tema claro/oscuro |

## Sobre el código de acceso

Es una **barrera de acceso**, no cifrado: el repositorio es público, así que el hash del código inicial se puede ver y un PIN de 4 dígitos se averigua con facilidad. Por eso este repositorio **no incluye tus notas**: se cargan desde tu archivo y quedan solo en tu navegador. Tras 5 fallos seguidos hay una espera creciente, y la app se bloquea sola tras 5 minutos sin uso.

## Estructura

```
index.html      pantalla de bloqueo + shell
css/styles.css  estilos (claro/oscuro, escritorio y móvil)
js/sha256.js    hash del código
js/xlsx-lite.js lector de .xlsx sin librerías
js/store.js     modelo, cálculos, importación/exportación
js/app.js       interfaz
```
