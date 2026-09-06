# UPI Party 0.2.0 — Islas

- Lobby con spawn central, islas temáticas, puentes, mapa y portales propios de cada modalidad.
- Cinco juegos offline; cuatro online: Aim, Sequence, Odd y Fakeout. Pelotas/Dance siguen offline.
- Dos parkours de precisión con checkpoint y reaparición, compartidos en el lobby online.
- Máximos personales por juego/modalidad y ladder pública; preservación de marcas anteriores.
- Colección serie 2: reset de cosméticos, fondos dentro del gacha común, una cápsula por récord personal o victoria 1v1; una como máximo por partida. Mítico: 0,5% total.
- Seis variantes de color de personajes y seis accesorios añadidos usando recursos existentes.
- Correcciones de entradas de Fakeout a varias rondas y presencia de bots.

QA: regresiones completas de los cinco juegos offline, dos navegadores aislados en HTTP/SSE (salas, gate, Memoria, resultados, gacha y Fakeout), ambos parkours por teclado, progresión v2, UI escritorio/móvil y paquete hosting. Instalador NSIS compilado con firma verificada contra la clave pública del actualizador anterior; ejecutable GUI sin consola.

La ladder usa identidad anónima por dispositivo y máximos enviados por clientes, sin anticheat fuerte. No se ha probado esta versión desde dos PCs remotas ni la actualización automática instalada en una PC de un amigo.
