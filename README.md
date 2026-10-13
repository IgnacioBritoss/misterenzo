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
| 2 | El vínculo | Albahaca para la cocina, juguetes, avisarle a Enzo cuando Luca se duerme |
| 3 | La distancia | Apagás luces, llega Nuria y te escondés bajo el sillón |
| 4 | La indiferencia | 5 plantas secas y el cargador escondido otra vez |
| 5 | El quiebre | El último día, y después el final de la historia |

## Minijuegos

- **Cerradura (estilo GTA):** si Luca te agarra te encierra en el baño. Frená la ganzúa en la zona verde para abrir cada perno.
- **Cables (estilo Among Us):** para que el cargador funcione hay que unir cada cable con el de su color.
- **Riego:** mantené apretado para echar agua y soltá en la zona verde. La regadera pierde agua si te movés.
- **Albahaca:** se corta en el vivero y hay que llevarla al cesto de la cocina antes de que se marchite.

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
