# UPI Party 0.2.7 — HUD de combate y dos arreglos de online

## Arreglos

- **Ya no te congelás para tu rival.** El giro del personaje se acumulaba frame a frame y, después de
  dos vueltas para el mismo lado (unos 10 segundos girando), el servidor empezaba a rechazar todas tus
  posiciones para siempre: vos te veías bien y tu amigo te veía quieto, y dejabas de contar para los
  portales. Ahora el giro se normaliza. **El arreglo vive en el servidor**, así que también corrige a
  quien todavía tenga una versión anterior instalada.
- **El vestuario y el panel Pokémon se pueden abrir dentro de una sala online**, mientras no haya
  partida en curso. Antes quedaban bloqueados al entrar a la sala, lo que hacía imposible elegir el
  equipo para un combate de colección. Si arranca la partida, el panel se cierra solo.

## Pantalla de combate Pokémon

- **Imágenes de los Pokémon**, animadas, servidas por Pokemon Showdown: tu Pokémon de espaldas y el
  rival de frente, como en el simulador. Sin conexión cae a un emblema con los colores de sus tipos.
- **Cada ataque muestra su tipo y qué tan efectivo es** contra el rival que está en el campo
  (×4, ×2, ×½, ×¼ o ✕). Se calcula con la tabla de tipos del propio motor.
- **Tooltip al pasar el mouse** (o con el teclado) sobre cualquier Pokémon: tipos, vida, estado,
  habilidad y objeto. Del rival solo se muestra lo que el combate hace público.
- Barra de vida que cambia de color según el riesgo, nivel de cada Pokémon y miniaturas en los
  botones de cambio, con los debilitados en gris.
- **Animación mínima**: un cartel indica quién atacó primero, el atacante se adelanta y el que recibe
  el golpe se sacude.
- El panel de colección también muestra las imágenes, en las tarjetas, el equipo y el sobre inicial.

## Datos

- El catálogo generado ahora incluye los **684 movimientos** de gen 9 (tipo, categoría y potencia) y la
  **tabla de efectividad de los 19 tipos**, ambos tomados del motor.
