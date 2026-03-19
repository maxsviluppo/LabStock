# LabStock - Gestione Magazzino

Applicazione per la gestione del magazzino di laboratorio, con tracciamento di entrate, uscite e costi.

## Setup per la pubblicazione (GitHub/Vercel/Netlify)

Per pubblicare questa applicazione su GitHub o altri servizi di hosting, segui questi passaggi:

1. **Firebase Setup**:
   - Crea un progetto su [Firebase Console](https://console.firebase.google.com/).
   - Abilita **Firestore Database** e **Authentication** (Google Provider).
   - Registra una Web App e copia le credenziali.

2. **Variabili d'Ambiente**:
   Configura le seguenti variabili d'ambiente nel tuo servizio di hosting (es. GitHub Actions secrets o Vercel environment variables):

   ```env
   VITE_FIREBASE_API_KEY=tuo_api_key
   VITE_FIREBASE_AUTH_DOMAIN=tuo_auth_domain
   VITE_FIREBASE_PROJECT_ID=tuo_project_id
   VITE_FIREBASE_APP_ID=tuo_app_id
   VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)
   ```

3. **Build**:
   Esegui `npm install` e poi `npm run build`. La cartella `dist` conterrà i file pronti per la pubblicazione.

## Note sulle Immagini
L'applicazione salva le immagini direttamente in Firestore come stringhe Base64. Per garantire prestazioni ottimali, le immagini vengono ridimensionate automaticamente prima del caricamento.
