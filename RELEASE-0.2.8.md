# UPI Party 0.2.8 — menú único y arreglos de la barra superior

## Menú con Escape

- Todas las opciones (Lobby, Mapa, 1v1, Menú, Pokémon, Vestuario, Fondos, Récords, gráficos,
  pantalla completa y ayuda) pasaron a un **único menú que se abre con `Esc`**, o con el botón
  **☰ Menú** de la esquina. La pantalla queda despejada tanto en el lobby como jugando.
- **Ese menú ahora también existe online.** Antes el juego escondía la barra entera al entrar a una
  sala y solo dejaba Mapa y Récords, así que no había forma de abrir el vestuario ni la colección
  Pokémon desde una partida online.
- Si tenés un panel abierto (vestuario, Pokémon), `Esc` cierra ese panel primero, como antes.

## Arreglos

- **La barra superior se desbordaba**: con el botón de Pokémon agregado ya no entraban todos, el
  botón quedaba aplastado a menos de la mitad de su ancho y el texto se montaba sobre el logo.
  Al mudar todo al menú, la barra quedó con dos elementos.
- **Las imágenes de los Pokémon se salían de su recuadro** en las tarjetas de la colección: la altura
  no estaba acotada y cada sprite se dibujaba con su tamaño original, así que unos desbordaban y
  otros se veían diminutos. Ahora todas ocupan una caja del mismo tamaño y se escalan para llenarla.
