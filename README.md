# Míster, el topo

Juego 2D con vista desde arriba, basado en *Kentukis* de Samanta Schweblin (la historia de Enzo).
Sos **Míster**, el kentuki topo. Cada día tenés tareas: regar las plantas del vivero, ordenar los juguetes,
apagar luces y avisarle a Enzo si Luca se duerme o no hace la tarea. Tenés que escapar de las trampas
de Luca y llegar al cargador antes de quedarte sin batería.

Trabajo de Guido Jacofsky, Zahir Fara, Lucas Park e Ignacio Britos.

## Los 5 días

| Día | Parte del libro | Qué pasa en el juego |
|-----|-----------------|----------------------|
| 1 | El topo llega | Arrancás encerrado en el baño, Luca escondió el cargador, regás 3 plantas |
| 2 | El vínculo | Ordenás juguetes, cuidás a Luca, él te encierra en el armario si te atrapa |
| 3 | La distancia | Apagás luces, Luca te da pataditas, llega Nuria y te escondés bajo el sillón |
| 4 | La indiferencia | Las plantas se secaron y el cargador vuelve a estar escondido |
| 5 | El quiebre | El último día, y después el final de la historia |

## Controles

- **PC:** flechas o WASD para moverte, Espacio o E para la acción, P o Esc para pausar.
- **Celular:** joystick abajo a la izquierda y botón **A** abajo a la derecha.

## Probarlo en tu compu

Es HTML, CSS y JS sin dependencias. Abrí `index.html` en el navegador, o levantá un servidor:

```bash
npx serve .
```

## Publicarlo en Vercel

1. Subí estos archivos a un repo de GitHub.
2. En vercel.com elegí **Add New → Project** e importá el repo.
3. En *Framework Preset* elegí **Other**. No hace falta comando de build y el directorio de salida es la raíz.
4. Hacé clic en **Deploy**. Con la URL que te da (`https://<proyecto>.vercel.app`) generá el QR para la presentación.
