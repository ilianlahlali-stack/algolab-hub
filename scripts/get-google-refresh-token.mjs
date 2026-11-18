#!/usr/bin/env node
// Récupère un refresh token Google pour la synchro Drive :
// lecture des métadonnées des dossiers + création/édition des seuls Google Docs créés par l'app (fiches).
// Usage :
//   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-google-refresh-token.mjs
// Le client OAuth doit être de type « Application de bureau », ou de type « Web »
// avec http://localhost:53682/callback dans les URI de redirection autorisées.

import http from "node:http";

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Définis GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET avant de lancer le script.");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://localhost:${PORT}/callback`;
const scope = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope,
  access_type: "offline",
  prompt: "consent",
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirectUri);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Aucun code reçu : " + url.search);
    return;
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await tokenRes.json();
  if (json.refresh_token) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("C'est bon, tu peux revenir au terminal.");
    console.log("\nÀ copier dans Vercel (variable d'environnement) :\n\nGOOGLE_REFRESH_TOKEN=" + json.refresh_token + "\n");
  } else {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Échec : " + JSON.stringify(json));
    console.error("Pas de refresh token reçu :", json);
  }
  server.close();
});

server.listen(PORT, () => {
  console.log("Ouvre cette adresse et connecte-toi avec ton compte Sciences Po :\n\n" + authUrl.toString() + "\n");
});
