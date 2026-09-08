# UPI Party 0.2.6 — combates Pokémon por turnos (BORRADOR, sin publicar)

- Minijuego Pokémon 1v1 sobre el motor abierto de Pokemon Showdown (licencia MIT), fijado en la versión 0.11.11.
- Colección local de 860 especies de las nueve generaciones, con estadísticas, tipos y habilidades tomados del motor.
  Al abrir el panel por primera vez se reparten 12 Pokémon distintos, una sola vez por perfil.
- Cada récord personal o victoria 1v1 entrega ahora una cápsula de accesorios **y además** un Pokémon nuevo.
  Las probabilidades de los cosméticos no cambiaron y las dos colecciones se guardan por separado.
- Dos modos de combate, ambos por sala privada con código:
  - **Colección**: se juega con los seis que elegiste, todos al mismo nivel y con sets predefinidos.
  - **Random Battle**: el servidor reparte dos equipos al azar del catálogo oficial de `gen9randombattle`
    (509 especies, las nueve generaciones). No usa ni modifica tu colección.
- El combate lo resuelve el servidor: cada jugador recibe solo su lado del campo y su propio turno;
  el equipo del rival nunca viaja al cliente.
- Ranking global de victorias Pokémon, con total y desglose Colección/Random. Lo escribe el servidor,
  una fila por combate, reusando la identidad anónima que ya usaba la tabla de récords.
- Los seis minijuegos anteriores, el lobby, el parkour, el vestuario, la ladder de récords, los WebSockets
  y el autoactualizador siguen igual: el modo Pokémon se agrega, no reemplaza nada.

## Notas de despliegue

- El servidor ahora necesita `pokemon-showdown` como dependencia de runtime (~147 MB instalados sin opcionales).
- Ranking: requiere la tabla `upi3d_pokemon_wins` y las variables `UPI_RANKING_URL` y `UPI_RANKING_SERVICE_KEY`.
  Sin configurar, los combates se juegan igual y las victorias no se publican.
- Cargar el motor cuesta ~122 MB de RSS y cuatro combates simultáneos llegaron a ~150 MB en las mediciones.
  **La máquina de Fly está en 256 MB: conviene subirla a 512 MB antes de publicar.**
