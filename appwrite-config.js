// Appwrite configuration placeholder.
// Replace the placeholder strings with your actual IDs from Appwrite console.
const APPWRITE_CONFIG = {
  endpoint: "https://sgp.cloud.appwrite.io/v1",
  projectId: "69416f7b00062e0015b4",
  databaseId: "69418ea700282a7f1bac",
  collections: {
    admins: "admins",
    events: "events"
  },
  bucketId: "69419d0a000e78807ded"
};

if (typeof Appwrite !== "undefined") {
  const client = new Appwrite.Client().setEndpoint(APPWRITE_CONFIG.endpoint).setProject(APPWRITE_CONFIG.projectId);

  window.appwrite = {
    client,
    account: new Appwrite.Account(client),
    databases: new Appwrite.Databases(client),
    storage: new Appwrite.Storage(client)
  };
} else {
  console.warn("Appwrite SDK not found. Make sure the CDN script is loaded before appwrite-config.js");
}
