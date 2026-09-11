# Guía: PC del trabajo como servidor central (piloto sin VPS)

Esta guía te lleva de "la app solo corre en mi PC cuando abro Docker" a
"las sedes envían campañas desde un link, con un backend central que corre
en una PC de la clínica encendida 24/7 — **costo total: S/ 0**".

> **Cuándo usar esta guía vs `GUIA-SEDES.md`:** esta variante es para el
> piloto (validar el producto sin pagar VPS). Cuando vendas el producto y
> compres el VPS, sigue `GUIA-SEDES.md` — la migración solo implica que cada
> sede pegue su nueva URL de webhook en Ajustes (10 segundos).

---

## Lo que vas a necesitar

| Concepto | Costo | Para qué |
|---|---|---|
| PC Windows en la clínica, encendida 24/7 | S/ 0 | Servidor backend (n8n + Evolution + Postgres) |
| Docker Desktop (WSL2) | Gratis | Correr el stack en la PC |
| Tailscale + Funnel | Gratis | HTTPS público sin abrir puertos ni comprar dominio |
| Vercel | Gratis | Hospedar el frontend (SPA) |
| **Total** | **S/ 0** | |

**Limitación aceptada en el piloto:** si se corta la luz o internet de la
clínica, las sedes dejan de enviar hasta que vuelva. Para validar el
producto está bien — y sirve para medir qué tan crítico es el uptime.

---

## Arquitectura en 30 segundos

```
[PC del trabajo 24/7 — Windows]
  Docker Desktop
    ├─ n8n            ← 127.0.0.1:5679  (solo local; el host usa 5679, no 5678)
    ├─ Evolution API  ← 127.0.0.1:8081  (solo local)
    └─ Postgres       (sin puerto público, red interna de Docker)
  Tailscale Funnel (corre en Windows)
    ├─ https://TU_HOSTNAME.ts.net/       → n8n
    └─ https://TU_HOSTNAME.ts.net:8443/  → Evolution

[Vercel] Frontend SPA (HTTPS, gratis, auto-deploy con git push)

[Las sedes] Solo un navegador + la URL de SU webhook en Ajustes
```

- Los contenedores publican puertos **solo en `127.0.0.1`**: nada queda
  expuesto a la LAN de la clínica ni al router.
- Tailscale Funnel es la única entrada pública, y siempre es HTTPS con
  certificado válido (obligatorio: un frontend en Vercel no puede hacer
  `fetch` a URLs `http://` — el navegador las bloquea).
- Multi-sede: **una instancia de Evolution por número de WhatsApp** y
  **un workflow de n8n por sede** (ver PARTE 6).

---

## PARTE 1 — Preparar la PC Windows (una sola vez, ~45 min)

### 1.1 — BIOS: prender sola tras un corte de luz

1. Reinicia la PC y entra a la BIOS/UEFI (normalmente `Supr`, `F2` o `F12`
   durante el arranque — depende de la marca).
2. Busca la opción **Restore AC Power Loss** / **After Power Failure** y
   ponla en **Power On**.
3. Guarda y sal. Así, tras un corte de luz, la PC vuelve sola.

### 1.2 — Windows: nunca suspender

1. Panel de control → Opciones de energía → **Cambiar la configuración del plan**.
2. Pone **"Suspender: Nunca"** y **"Apagar pantalla: a tu gusto"** (apagar la
   pantalla no afecta al servidor).
3. Configura **inicio de sesión automático** (netplwiz → desmarca "Los
   usuarios deben escribir su nombre y contraseña") o deja la sesión
   abierta: Docker Desktop necesita sesión iniciada para arrancar.

### 1.3 — Windows Update

Configuración → Windows Update → **Horas activas**: pon el horario de
atención de la clínica. Así Windows no reinicia con recepcionistas enviando
campañas.

### 1.4 — Instalar Docker Desktop

1. Descarga **Docker Desktop for Windows** desde https://www.docker.com/products/docker-desktop/
   (backend WSL2; el instalador lo habilita solo).
2. Instala, reinicia si lo pide, abre Docker Desktop y espera a que diga
   **"Engine running"**.
3. Deja activada **"Start Docker Desktop when you sign in"** (viene por defecto).

### 1.5 — Instalar Tailscale y habilitar Funnel

1. Instala **Tailscale** desde https://tailscale.com/download e inicia sesión.
2. En la consola admin: https://login.tailscale.com/admin/acls — agrega:

   ```json
   "nodeAttrs": [
     {
       "target": ["*"],
       "attr": ["funnel"]
     }
   ]
   ```

   (al mismo nivel que la clave `"acls"` existente, con coma).
3. En PowerShell de la PC, verifica y anota tu hostname:

   ```powershell
   tailscale status
   ```

   Ese hostname (ej. `mi-pc.mi-tailnet.ts.net`) es tu **`TU_HOSTNAME`**.

---

## PARTE 2 — Correr el stack en la PC (~20 min)

### 2.1 — Clonar el repositorio

```powershell
git clone https://github.com/admvetarielscv-crypto/VetCampaignManager.git
cd VetCampaignManager\deploy
```

### 2.2 — Crear el `.env.pc`

```powershell
copy .env.pc.example .env.pc
notepad .env.pc
```

Completa:

- `TS_HOSTNAME` — el hostname del paso 1.5. **Obligatorio**: si falta,
  el `SERVER_URL` de Evolution queda inválido y rechaza todas las rutas
  (ver diagnóstico en PARTE 9).
- `N8N_USER` y `N8N_PASSWORD` — credenciales del panel de n8n. **Cámbialos**.
- `EVO_API_KEY` — genera uno aleatorio en PowerShell:
  ```powershell
  -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  ```
- `POSTGRES_PASSWORD` — cualquier string fuerte (solo interno).

### 2.3 — Levantar los servicios

```powershell
docker compose -f docker-compose.pc.yml --env-file .env.pc up -d
```

La primera vez tarda unos minutos (descarga imágenes). Verifica:

```powershell
docker compose -f docker-compose.pc.yml --env-file .env.pc ps
```

Todos deben decir `Up` o `healthy`. Luego abre en el navegador **de la PC**:

- `http://localhost:5679` — panel de n8n (credenciales del `.env.pc`).
- `http://localhost:8081` — debe mostrar el JSON **"Welcome to the Evolution API"**.
- `http://localhost:8081/manager` — interfaz gráfica de Evolution.

> Si el `docker` de PowerShell falla con "API route and version… 500" mientras
> Docker Desktop está abierto, tu CLI está más viejo que el motor. Parche:
> `$env:DOCKER_API_VERSION="1.44"` en esa sesión de PowerShell antes de
> usar `docker …`. O usa las pestañas **Exec/Inspect** del propio Docker
> Desktop. (La solución de fondo es actualizar Docker Desktop.)

---

## PARTE 3 — Abrir el túnel Tailscale Funnel (~5 min)

En PowerShell de la PC:

```powershell
tailscale funnel --bg 443:http://127.0.0.1:5679
tailscale funnel --bg 8443:http://127.0.0.1:8081
```

Verifica que quedó activo (estos comandos se **persisten**; tras reinicios
se reactivan solos junto con el servicio de Tailscale):

```powershell
tailscale funnel status
```

### Verificación desde afuera (importante)

Desde tu **celular con datos móviles** (fuera del WiFi de la clínica):

1. `https://TU_HOSTNAME.ts.net` — panel de n8n.
2. `https://TU_HOSTNAME.ts.net:8443` — el JSON "Welcome…" de Evolution.
3. `https://TU_HOSTNAME.ts.net:8443/manager` — interfaz del Manager.

---

## PARTE 4 — Conectar el WhatsApp de tu sede con el Manager (~15 min)

Lo más simple ahora es usar el **Evolution Manager** (`https://TU_HOSTNAME.ts.net:8443/manager`,
te pide **Server URL** = `https://TU_HOSTNAME.ts.net:8443` y tu **API Key Global** = `EVO_API_KEY`):

1. **Create new instance** → Nombre: `sede1` (o el nombre de tu sede;
   minúsculas, sin espacios) → Canal: Baileys → aparece el **QR**.
2. Escanea con el celular de la sede: WhatsApp → Menú ⋮ → **Dispositivos
   vinculados** → Vincular un dispositivo.
3. Verifica `connectionStatus: open` (verde en el Manager).

### Webhook saliente de la instancia

En la instancia, la sección **Webhook** (events como `messages_upsert`,
`send_message`) es para el flujo *contrario* (Evolution avisa a alguien
cuando pasa algo). Para el piloto **déjalo desactivado** — si queda apuntando
a una ruta inexistente de n8n, solo llena los logs de ruido
("requested webhook … is not registered").

## PARTE 5 — Crear el workflow de envío en n8n (~30 min, una vez)

En `https://TU_HOSTNAME.ts.net`, crea un workflow:

```
[Webhook] → [Code] → [IF media] → [HTTP Request texto] / [HTTP Request media]
```

**Nodo Webhook**: Method POST, Path `sede1`, Response Mode: **"Immediately"**
(así la app recibe el 200 al instante y el envío corre en background).

**Nodo Code** (mapeo del payload de la app — uno por destinatario):

```js
const body = $input.first().json.body;
return body.recipients.map(r => ({ json: {
  number: r.phone.replace(/\D/g, ''),           // "+51…" → "519…"
  text: r.message,
  mediaKey: r.mediaKey ?? null,
  media: r.mediaKey && body.media ? body.media[r.mediaKey] : null,
}}));
```

> El payload que envía la app (`src/lib/campaign.ts`) trae
> `recipients[]` con `phone` ya normalizado (`+51…`), `message` completo,
> y un mapa `media` con las imágenes de las plantillas (data URI base64).

**HTTP Request texto**: POST a
`http://vcm_evolution_api:8080/message/sendText/sede1` — vía la **red interna
de Docker** (¡no la URL pública!). Header Auth: `apikey` = `EVO_API_KEY`.
Body: `{"number": "{{ $json.number }}", "text": "{{ $json.text }}"}`

**HTTP Request media**: POST a
`http://vcm_evolution_api:8080/message/sendMedia/sede1`. Mismo Header Auth.
Body:

```json
{
  "number": "{{ $json.number }}",
  "mediatype": "image",
  "media": "{{ $json.media.data.split(',')[1] }}",
  "mimetype": "{{ $json.media.mimetype }}",
  "fileName": "{{ $json.media.fileName }}"
}
```

> El `split(',')[1]` quita el prefijo `data:image/png;base64,` — Evolution
> quiere el base64 pelado.

**Activa el workflow** (toggle "Active" arriba a la derecha). Un workflow sin
activar solo responde en `webhook-test/…`, no en `webhook/…`.

## PARTE 6 — Agregar una nueva sede (~20 min por sede)

**El modelo**: cada sede = 1 instancia de Evolution (su número) + 1 workflow
de n8n + su URL de webhook en Ajustes de la app.

1. **Manager** → Create new instance → `sede2` → escanea el QR con el
   celular de ESA sede (presencial o videollamada; es lo único presencial).
   Cada instancia = un número distinto; nunca el mismo número en dos instancias.
2. **n8n** → abre el workflow que funciona → ⋮ → **Duplicate**. En la copia
   cambia solo:
   - Webhook → Path: `sede2`
   - HTTP Request texto → `…/message/sendText/sede2`
   - HTTP Request media → `…/message/sendMedia/sede2`
   - Toggle **Active: ON** (el original sigue activo; rutas distintas, no chocan).
3. **Recepcionista**: abre la app → **Ajustes → Webhook de envío n8n** → pega
   `https://TU_HOSTNAME.ts.net/webhook/sede2` → Guardar.

> ⚠️ **El error más costoso posible**: la `VITE_N8N_WEBHOOK_URL` de Vercel es
> el *default* (apunta a la sede 1). Si una recepcionista no pega SU URL en
> Ajustes, **sus envíos saldrán por el WhatsApp de otra sede**. Primer paso
> del onboarding: configurar su webhook.

> 📱 Las categorías y plantillas de la app viven en el **localStorage de cada
> navegador**: cada sede ve y crea las suyas, no se comparten (para catálogo
> compartido centralizado existe Supabase, activable a futuro).

**URL final de cada webhook** (la de Ajustes):
- Sede 1: `https://TU_HOSTNAME.ts.net/webhook/sede1`
- Sede 2: `https://TU_HOSTNAME.ts.net/webhook/sede2` … etc.

## PARTE 7 — Frontend en Vercel (~10 min)

Sigue la **PARTE 4 de `GUIA-SEDES.md`** (importar el repo, build
`npm run build`, output `dist`). Sin cambios.

## PARTE 8 — Resiliencia y mantenimiento

### Prueba de fuego (hazla ANTES de dar acceso a las sedes)

1. **Reinicia la PC completa.** Espera 3-4 minutos y verifica desde el celular:
   n8n responde, Evolution responde (`/`), la instancia sigue `open`, y un
   envío de prueba sale.
2. Si algo no levanta: sesión de Windows iniciada, Docker Desktop en inicio
   automático, `docker compose ps` (¿todo `Up`?) y `tailscale funnel status`.

### Alertas de caída gratis

Crea una cuenta en https://uptimerobot.com y agrega un monitor HTTP(s) a
`https://TU_HOSTNAME.ts.net/healthz`. Te avisa por email si el servidor cae.

### Respaldos — dos tipos, dos propósitos

| Tipo | Qué protege | Cómo |
|---|---|---|
| **Config** (compose + `.env.pc` + exports de workflows de n8n + comandos del funnel) | El "cómo está armado" | Copiar a Notion/Drive personal/USB. Se hace una vez y con cada cambio. El `.env.pc` **nunca** entra a git. |
| **Datos** (sesiones WhatsApp, workflows, credenciales, historial) | Los volúmenes `vcm_db_storage` y `vcm_n8n_storage` | Semanal: |
```powershell
# DB (sesiones de WhatsApp + datos de Evolution y n8n)
docker compose -f docker-compose.pc.yml --env-file .env.pc exec db `
  pg_dump -U postgres evolution > backup-evolution-$(Get-Date -Format yyyy-MM-dd).sql

# n8n completo (workflows + credenciales)
docker run --rm -v vcm_n8n_storage:/data -v ${PWD}:/backup alpine `
  tar czf /backup/n8n-backup-$(Get-Date -Format yyyy-MM-dd).tar.gz /data
```

### Logs

```powershell
docker compose -f docker-compose.pc.yml --env-file .env.pc logs -f
```

---

## PARTE 9 — Lecciones de la depuración (léelas ANTES de tocar nada)

Estas fueron las trampas reales del piloto, en orden de aparición:

1. **`restart: always` ≠ recreate.** Editar el `.yml` o el `.env` NO cambia
   los contenedores que ya corren: el restart re-enciende con la config
   **vieja**. Para aplicar cambios: `docker compose … up -d --force-recreate`.
2. **Verifica el env REAL del contenedor, no el archivo.** Las variables se
   hornean al crear el contenedor:
   ```powershell
   docker exec vcm_evolution_api printenv SERVER_URL
   docker exec vcm_n8n_app printenv N8N_HOST
   ```
   (o pestaña Exec/Inspect de Docker Desktop).
3. **`SERVER_URL` inválido = Evolution rechaza todo.** Si `TS_HOSTNAME` no
   está definida, `SERVER_URL` queda `https://:8443` (inválida) y TODAS las
   rutas devuelven `{"code":"1-11","msg":"Invalid url."}` — incluso `/`.
   Un Evolution sano siempre responde en `/` con el JSON "Welcome…".
4. **"Error: Connection Closed"** = la sesión de WhatsApp de esa instancia
   está caída (no es problema de red). Reconectar en el Manager (QR nuevo);
   la sesión vive en el volumen de datos y sobrevive a recreaciones.
5. **El puerto publicado puede no existir.** Si Docker Desktop no muestra
   el puerto en la columna Port(s), el contenedor fue creado antes de que
   el compose lo declarara. Recrear (punto 1).
6. **URL interna vs URL pública**: para n8n → Evolution usa SIEMPRE la red
   interna (`http://vcm_evolution_api:8080/...`); la URL pública del funnel
   es solo para acceso humano (Manager, paneles, pruebas remotas). Así el
   envío no depende de Tailscale ni del internet de la clínica.
7. **CLI de Docker viejo**: error "check if the server supports the requested
   API version" → `$env:DOCKER_API_VERSION="1.44"` en la sesión, o usa el
   GUI; la solución de fondo es actualizar Docker Desktop.
8. **Versiones fijadas en el compose**: `:latest` en evolution-api es
   peligroso (v2.4+ exige licencia). Actualizar versiones solo de forma
   deliberada, con backup previo.
9. **Deuda conocida**: n8n comparte la DB `evolution` con Evolution API.
   Funciona, pero a futuro conviene separar (DB propia para n8n o su SQLite).

## PARTE 10 — Migración futura (Cloudflare Tunnel o VPS)

El stack Docker **no cambia ni una línea**. Solo cambia la "puerta" pública:

1. **Cloudflare Tunnel (cuando compres dominio):** instala `cloudflared`,
   apunta `n8n.tudominio.com` → `http://localhost:5679` y
   `evo.tudominio.com` → `http://localhost:8081`. Borra los funnels.
2. **VPS (cuando vendas):** sigue `GUIA-SEDES.md` PARTE 1; exporta/importa
   los workflows de n8n (Download del JSON en n8n → Import from file).
3. En ambos casos cada sede pega su nueva URL de webhook en Ajustes
   (10 segundos, documentado en `GUIA-SEDES.md` → "Cambié de VPS").

> La URL interna `http://vcm_evolution_api:8080` de los workflows nunca
> cambia — por eso se eligió desde el principio.

---

## Solución de problemas

### "El navegador no conecta a TU_HOSTNAME.ts.net"
- PC: `docker compose … ps` (¿todo `Up`?) y `tailscale funnel status`.
- ¿La PC tiene internet? ¿Sesión de Windows iniciada? ¿Docker Desktop
  "Engine running"?

### "n8n da error 500 / Connection Closed al enviar"
La sesión de WhatsApp de esa instancia está caída → Manager → reconectar
(QR nuevo). No es problema de red.

### "n8n log: 'requested webhook … is not registered'"
Alguien hace POST a una ruta sin workflow activo:
- ¿El workflow tiene toggle **Active** encendido?
- ¿El **Path** del Webhook coincide con la URL configurada
  (ej. `vet-campaign` / `sede2`)?
- Si el POST viene de Evolution (webhook saliente de events) → desactiva
  ese webhook en el Manager.

### "Los mensajes salen por el WhatsApp equivocado"
La recepcionista no configuró SU webhook en Ajustes (usó el default de
Vercel). Configurar el URL de su sede.

### "El QR no aparece o expira rápido"
Manager → la instancia → reconectar (QR nuevo). También:
```powershell
curl.exe -s -X POST "https://TU_HOSTNAME.ts.net:8443/instance/connect/sede1" -H "apikey: TU_API_KEY"
```

### "Cambió el hostname de Tailscale"
1. Actualiza `TS_HOSTNAME` en `.env.pc`.
2. `docker compose -f docker-compose.pc.yml --env-file .env.pc up -d --force-recreate`
3. Re-crea los funnels (PARTE 3).
4. Avisa a cada sede que actualice su URL de webhook en Ajustes.
