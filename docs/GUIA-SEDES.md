# Guía de distribución multi-sede — VetCampaignManager

Esta guía te lleva paso a paso de "tengo la app funcionando solo en mi sede" a "las 3 sedes envían campañas desde un link, sin instalar nada en sus computadoras".

---

## Lo que vas a necesitar

| Concepto | Costo | Lo necesitas para |
|---|---|---|
| VPS (Hetzner CX22 4GB) | ~$5/mes | Hospedar n8n + Evolution API + HTTPS |
| Dominio (opcional, recomendado a largo plazo) | ~$10/año | URLs estables para las 3 sedes |
| **Total** | **~$5–7/mes** | |

**Si no quieres comprar dominio todavía:** la guía usa `sslip.io`, un servicio gratuito que convierte tu IP en dominio válido para HTTPS. Empieza con eso y compra dominio después.

---

## Arquitectura en 30 segundos

```
[Vercel]                [Tu VPS]                              [Las 3 sedes]
Frontend estático ───►  ┌─────────────────────┐               ┌──────────┐
(HTTPS, gratis)         │ Caddy (HTTPS auto)   │               │  Sede 1  │
                        │   │                  │               │  Sede 2  │
                        │   ├──► n8n           │ ◄─ webhook ───│  Sede 3  │
                        │   └──► Evolution API │   (WhatsApp)  └──────────┘
                        │         (3 instancias│
                        │          una por sede)│
                        └─────────────────────┘
```

- **El frontend vive en Vercel** (gratis, HTTPS, auto-deploy cuando haces `git push`).
- **El backend vive en tu VPS** (Docker con Caddy + n8n + Evolution + Postgres).
- **Las PCs de las recepcionistas solo necesitan un navegador.** No instalan nada.

---

## PARTE 1 — Levantar el backend en el VPS (solo la primera vez, ~1h)

### Paso 1.1 — Comprar y configurar el VPS

1. Ve a **https://www.hetzner.com/cloud** y crea una cuenta.
2. Crea un nuevo servidor:
   - **Imagen:** Ubuntu 24.04
   - **Tipo:** CX22 (2 vCPU, 4GB RAM, 40GB SSD) — ~€4.5/mes
   - **Ubicación:** la más cercana a tus sedes
   - **SSH key:** genera una y agrégala (en Hetzner → Settings → SSH keys), o usa password si te resulta más fácil
3. Una vez creado, anota la **IP pública** del servidor (en la columna "Public IPv4"). La llamaremos `TU_IP` de aquí en adelante.
4. Conéctate desde tu PC:
   ```bash
   ssh root@TU_IP
   ```
   Te pedirá aceptar el fingerprint — di "yes". Si usaste SSH key, entra directo.

### Paso 1.2 — Instalar Docker en el VPS

Una vez dentro del VPS (ves algo como `root@ubuntu:~#`), ejecuta:

```bash
# Actualizar paquetes
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose plugin (ya viene con Docker moderno, pero por si acaso)
apt install -y docker-compose-plugin

# Verificar
docker --version
docker compose version
```

### Paso 1.3 — Clonar el repositorio en el VPS

```bash
# Instalar git si no está
apt install -y git

# Clonar tu repo (sustituye por la URL real)
git clone https://github.com/admvetarielscv-crypto/VetCampaignManager.git
cd VetCampaignManager/deploy
```

### Paso 1.4 — Crear tu `.env` del deploy

```bash
cp .env.example .env
nano .env   # o usa vim, lo que prefieras
```

Editá estas líneas (las demás déjalas como están por ahora):

- `VPS_IP` — pon tu IP pública real (la que anotaste en Paso 1.1).
- `N8N_DOMAIN` — por defecto `n8n.TU_IP.sslip.io`. Funciona gratis, no tenés que cambiarlo.
- `EVO_DOMAIN` — idem, `evo.TU_IP.sslip.io`.
- `LETSENCRYPT_EMAIL` — tu correo real (para avisos de renovación de HTTPS).
- `N8N_USER` y `N8N_PASSWORD` — usuario y contraseña para entrar al panel de n8n. **Cambialos** por algo fuerte.
- `EVO_API_KEY` — genera uno con:
  ```bash
  openssl rand -hex 32
  ```
  Copia el resultado y pégalo en `.env` después de `EVO_API_KEY=`.
- `POSTGRES_PASSWORD` — cualquier string fuerte (no lo necesitas para nada externo).

Guarda el archivo (`Ctrl+O`, `Enter`, `Ctrl+X` en nano).

### Paso 1.5 — Levantar los servicios

```bash
docker compose -f docker-compose.prod.yml up -d
```

Esto descarga todas las imágenes (tarda unos minutos la primera vez). Cuando termine verás algo como:
```
 ✔ Network vcm_vcm-net     Created
 ✔ Volume vcm_caddy_data   Created
 ✔ ... 
 ✔ Container vcm-postgres-1   Started
 ✔ Container vcm-evolution-1  Started
 ✔ Container vcm-n8n-1        Started
 ✔ Container vcm-caddy-1      Started
```

Verifica que todos están corriendo:
```bash
docker compose -f docker-compose.prod.yml ps
```

Todos deben decir `Up` o `healthy`. Si Caddy tarda unos segundos en obtener los certificados, está bien.

### Paso 1.6 — Verificar que HTTPS funciona

Desde tu PC local (no desde el VPS), abrí en el navegador:
- `https://n8n.TU_IP.sslip.io` — debería pedirte usuario y contraseña de n8n (los que pusiste en `.env`).
- `https://evo.TU_IP.sslip.io` — debería mostrar algo de Evolution API (puede ser un 404 o un JSON, está bien).

Si ves el candado 🔒 en el navegador, **funciona**. Ya tienes HTTPS automático con Let's Encrypt.

> **Si el navegador dice "no se puede conectar"**, esperá 1-2 minutos (Caddy está solicitando los certificados) y probá de nuevo.

---

## PARTE 2 — Crear las 3 instancias de WhatsApp en Evolution (~15 min)

### Paso 2.1 — Crear la primera instancia (sede 1)

Desde tu PC, con la API key y la URL de Evolution (la del `.env`):

**macOS / Linux:**
```bash
EVO_URL="https://evo.TU_IP.sslip.io"
EVO_KEY="PEGA-AQUI-TU-EVO_API-KEY"

curl -X POST "$EVO_URL/instance/create" \
  -H "apikey: $EVO_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "sede1", "qrcode": true}'
```

**Windows (PowerShell):**
```powershell
$EVO_URL = "https://evo.TU_IP.sslip.io"
$EVO_KEY = "PEGA-AQUI-TU-EVO_API-KEY"

Invoke-RestMethod -Method Post -Uri "$EVO_URL/instance/create" `
  -Headers @{"apikey"=$EVO_KEY; "Content-Type"="application/json"} `
  -Body '{"instanceName": "sede1", "qrcode": true}'
```

La respuesta incluye un QR en base64. Mostralo en una pestaña del navegador o convertilo a imagen (hay extensiones para Chrome que muestran base64).

### Paso 2.2 — Escanear el QR desde el celular de la sede 1

1. En el celular de la sede, abrí **WhatsApp**.
2. Andá a **Menú ⋮ → Dispositivos vinculados → Vincular un dispositivo**.
3. Apuntá la cámara al QR que viste arriba.
4. Cuando se vincule, verás "Dispositivo vinculado" en WhatsApp.

Repetí con `sede2` y `sede3` (cada una con su propio celular y número). **Sí, necesitás tener el celular de cada sede a mano para escanear el QR** (es igual que WhatsApp Web). Esto es lo único que requiere presencial o videollamada con el encargado.

### Paso 2.3 — Verificar las instancias conectadas

```bash
curl "$EVO_URL/instance/fetchInstances" \
  -H "apikey: $EVO_KEY"
```

Deberías ver 3 instancias con `connectionStatus: "open"`.

---

## PARTE 3 — Crear el workflow en n8n (~30 min, una sola vez)

1. Abrí `https://n8n.TU_IP.sslip.io` en tu navegador.
2. Logueate con las credenciales de `.env`.
3. Creá un **nuevo workflow** con este flujo:

```
[Webhook] ──► [HTTP Request a Evolution API] ──► [Respond to Webhook]
```

**Nodo 1 — Webhook** (recibe el POST de la app):
- Method: POST
- Path: `sede1` (luego creás otro workflow con path `sede2`, etc.)
- Authentication: None (por ahora, Fase 4 añadiremos HMAC)

**Nodo 2 — HTTP Request a Evolution** (envía el mensaje):
- Method: POST
- URL: `https://evo.TU_IP.sslip.io/message/sendText/sede1`
  - ⚠️ Reemplazá `sede1` por el nombre real de la instancia según corresponda
- Authentication: Generic Credential Type → Header Auth
  - Name: `apikey`
  - Value: tu `EVO_API_KEY`
- Body (JSON):
  ```json
  {
    "number": "{{ $json.body.recipients[0].phone }}",
    "text": "{{ $json.body.recipients[0].message }}"
  }
  ```

> **Nota para el MVP:** el ejemplo arriba solo envía a UN destinatario. Para un MVP con 3 sedes está bien. Para producción real, el workflow debería iterar sobre `recipients[]` y enviar uno por uno (o usar el endpoint `sendMultipleContacts` de Evolution). Cuando llegues a ese punto, te ayudo a expandirlo.

**Nodo 3 — Respond to Webhook**:
- Respond With: JSON
- Response Body: `{"ok": true}`

Activá el workflow (toggle arriba a la derecha).

Repetí para `sede2` y `sede3` (3 workflows separados, cada uno con su instancia Evolution).

**URL final de cada webhook** (la que va en Ajustes de la app):
- `https://n8n.TU_IP.sslip.io/webhook/sede1`
- `https://n8n.TU_IP.sslip.io/webhook/sede2`
- `https://n8n.TU_IP.sslip.io/webhook/sede3`

---

## PARTE 4 — Desplegar el frontend en Vercel (~10 min)

1. Ve a **https://vercel.com** y crea una cuenta (puedes entrar con GitHub directo).
2. Click **Add New → Project**.
3. Importa el repositorio `VetCampaignManager`.
4. Vercel detecta automáticamente que es Vite. Confirmá:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**. Espera 1-2 minutos.
6. Vercel te da una URL pública del estilo `vetcampaign-manager-tu-usuario.vercel.app`. **Esa es la URL que compartirás con las 3 sedes.**

> **No necesitás configurar variables de entorno en Vercel.** Las variables `VITE_*` están todas vacías por defecto, así que la app arranca en modo localStorage. Cuando en el futuro quieras habilitar Supabase, agregás `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel → Settings → Environment Variables.

Cada vez que hagas `git push` a la rama `main`, Vercel despliega solo. No tocás más.

---

## PARTE 5 — Activar las 3 sedes (5 min por sede)

Para cada sede, hacé esto:

### Lo que necesitás tener listo de antemano:
- URL del frontend: `https://vetcampaign-manager-tu-usuario.vercel.app`
- URL del webhook de esa sede (la que anotaste en Parte 3):
  - Sede 1: `https://n8n.TU_IP.sslip.io/webhook/sede1`
  - Sede 2: `https://n8n.TU_IP.sslip.io/webhook/sede2`
  - Sede 3: `https://n8n.TU_IP.sslip.io/webhook/sede3`

### Lo que la recepcionista hace (manual de 1 página para ella):

1. Abre el navegador (Chrome, Edge, Firefox — cualquiera moderno).
2. Entra a `https://vetcampaign-manager-tu-usuario.vercel.app`.
3. Anda a **Ajustes → Webhook de envío n8n**.
4. Pegá la URL de webhook de tu sede (la que te pasó el encargado).
5. Click **Guardar**.
6. Listo. Para mandar una campaña:
   - Anda a **Inicio**.
   - Importa el Excel de VetPraxis.
   - Revisa los destinatarios.
   - Click **Enviar campaña** → **Confirmar**.

Sus categorías y plantillas quedan guardadas en su navegador (no se borran al cerrar). Cada sede tiene las suyas propias.

---

## Mantenimiento (cuando lo necesites)

### Ver logs del backend
```bash
ssh root@TU_IP
cd VetCampaignManager/deploy
docker compose -f docker-compose.prod.yml logs -f
```

### Actualizar n8n o Evolution
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Backup de la base de datos de Evolution
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres evolution | gzip > backup-$(date +%F).sql.gz
```

### Backup del workflow de n8n
Los workflows están en `n8n_data`. Para hacer backup:
```bash
docker run --rm -v vcm_n8n_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/n8n-backup-$(date +%F).tar.gz /data
```

---

## Solución de problemas

### "El navegador dice que no se puede conectar al VPS"
- Verificá que el VPS esté encendido: `ssh root@TU_IP`.
- Verificá que Caddy esté corriendo: `docker compose -f docker-compose.prod.yml ps`.
- Esperá 2-3 minutos si acabás de levantar — Caddy está pidiendo certificados.

### "El QR no aparece o expira rápido"
Pedí uno nuevo:
```bash
curl -X POST "$EVO_URL/instance/connect/sede1" \
  -H "apikey: $EVO_KEY"
```

### "Cambié de VPS (otra IP)"
1. Editá `deploy/.env` con la nueva IP.
2. `docker compose -f docker-compose.prod.yml restart caddy`.
3. Avisá a cada sede que actualice su URL de webhook en Ajustes (es un copy-paste de 10 segundos).

### "Quiero un dominio propio"
1. Comprá un dominio (Namecheap, Porkbun, Cloudflare Registrar).
2. En el panel DNS, creá dos registros A:
   - `n8n.tuclinica.com` → `TU_IP`
   - `evo.tuclinica.com` → `TU_IP`
3. Esperá unos minutos a que propaguen.
4. Cambiá `N8N_DOMAIN` y `EVO_DOMAIN` en `.env`.
5. Reiniciá Caddy: `docker compose -f docker-compose.prod.yml restart caddy`.

---

## Próximos pasos (cuando crezcas)

| Necesidad | Solución |
|---|---|
| Compartir plantillas entre sedes | Activar Supabase (Fase 2 ya está implementada) |
| Auditoría central de envíos | Activar Supabase |
| Roles (admin/recepcionista) | Activar Supabase + Auth |
| Firmar los webhooks (anti-falsificación) | Fase 4: HMAC signing (n8n ya lo soporta) |
| Pasar de Evolution API a WhatsApp Business API oficial | Migrar n8n workflow cuando WhatsApp Meta te apruebe |

Cualquiera de esas cosas ya está **parcialmente construida** en el código. Solo se activa cuando la necesites.
