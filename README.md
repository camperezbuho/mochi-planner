# 🐱 Mochi Planner

Tu planner personal con estética cute y pastel. Construido con HTML/CSS/JS vanilla + Firebase Firestore + Cloudflare Pages.

---

## ✨ Features

- **Dashboard** con resumen del día, hábitos y progreso
- **To-do list** con kanban (En progreso / Pendientes / Completadas)
- **Hábitos** con racha diaria y recordatorios
- **Calendario mensual** con eventos
- **Vista semanal** y **diaria** tipo agenda
- **Notificaciones push** del navegador para recordatorios
- **Búsqueda y filtros** en tiempo real
- Datos guardados en **Firebase Firestore**
- Deploy en **Cloudflare Pages**

---

## 🚀 Setup paso a paso

### 1. Crear proyecto Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto (ej: `mochi-planner`)
3. Ir a **Firestore Database** → Crear base de datos → Modo producción
4. Ir a **Project Settings** → **Your apps** → Agregar app web (icono `</>`)
5. Copiar la configuración

### 2. Configurar Firebase en la app

Abrir `public/js/firebase-config.js` y reemplazar con tus valores:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 3. Reglas de Firestore

En Firebase Console → Firestore → Reglas, pegar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Esto permite acceso libre (sin login). Podés restringir por IP o agregar auth luego.

### 4. Probar localmente

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

### 5. Deploy en Cloudflare Pages

**Opción A: Via GitHub (recomendado)**

1. Subir este proyecto a un repo de GitHub
2. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages
3. Create application → Pages → Connect to Git
4. Seleccionar tu repo
5. Build settings:
   - **Build command:** (vacío, es sitio estático)
   - **Build output directory:** `public`
6. Deploy

**Opción B: Via CLI**

```bash
npm install
npx wrangler pages deploy public
```

---

## 📁 Estructura del proyecto

```
mochi-planner/
├── public/
│   ├── index.html          # App principal
│   ├── manifest.json       # PWA manifest
│   ├── css/
│   │   └── style.css       # Design system Pastel Whimsy
│   ├── js/
│   │   ├── app.js          # Lógica principal
│   │   ├── db.js           # Operaciones Firebase CRUD
│   │   ├── firebase-config.js  # ← CONFIGURAR ESTO
│   │   └── notifications.js    # Push notifications
│   └── cats/               # Imágenes de gatitos 🐱
│       ├── cat-peeking.png
│       ├── cat-pencil.png
│       ├── cat-yarn.png
│       └── cat-cloud.png
├── package.json
└── README.md
```

---

## 🎨 Design System

Basado en **Pastel Whimsy**:
- **Fuente display:** Bricolage Grotesque
- **Fuente cuerpo:** Plus Jakarta Sans
- **Color primario:** Lavanda suave `#625981`
- **Secundario:** Verde menta `#566246`
- **Terciario:** Rosa pastel `#78555e`

---

## 🔔 Notificaciones

Las notificaciones push requieren que el navegador las permita. Al abrir la app por primera vez, aparecerá un banner para activarlas. Las notificaciones se disparan:

- **1 minuto antes** del recordatorio de cada tarea
- **A la hora configurada** para cada hábito diario

---

## 🛠️ Personalización

### Agregar categorías
En `index.html`, buscá el `<select id="taskCategory">` y agregá `<option>` nuevas.

### Cambiar colores
En `css/style.css`, modificá las variables CSS en `:root`.

### Agregar vistas
Creá un nuevo `<div class="page" id="page-nueva">` y su nav-item correspondiente.
