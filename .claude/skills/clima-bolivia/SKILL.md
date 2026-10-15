---
name: clima-bolivia
description: Temperatura actual de Bolivia (La Paz, Santa Cruz, Cochabamba, Sucre). Usar cuando el usuario pregunte por el clima, tiempo o temperatura en Bolivia.
---

# Clima Bolivia

Obtiene la temperatura actual de las principales ciudades de Bolivia con Open-Meteo (gratis, sin API key).

## Pasos

1. Ejecutar (una sola llamada, 4 ciudades en orden: La Paz, Santa Cruz, Cochabamba, Sucre):

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=-16.50,-17.78,-17.39,-19.04&longitude=-68.15,-63.18,-66.16,-65.26&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=America/La_Paz"
```

2. La respuesta es un array JSON, un objeto por ciudad, en el mismo orden. Leer `current.temperature_2m` (°C), `current.apparent_temperature`, `current.relative_humidity_2m`.
3. Responder en español, muy conciso, formato tabla o lista:

```
La Paz: 12°C (sens. 10°C), hum 40%
Santa Cruz: ...
```

4. Si el usuario pide una ciudad específica, mostrar solo esa. Si falla la llamada, decirlo; no inventar valores.
