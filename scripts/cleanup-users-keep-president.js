const admin = require("firebase-admin");

const KEEP_UID = "7kQSF1BSugZqsJXbbMZMceZOxwI3";
const DRY_RUN = process.argv.includes("--dry-run");

admin.initializeApp({
  projectId: "rcph-admin",
});

const db = admin.firestore();

async function deleteFirestoreDocsExcept(collectionName, keepUid) {
  const snap = await db.collection(collectionName).get();

  let batch = db.batch();
  let ops = 0;
  let deleted = 0;

  for (const doc of snap.docs) {
    if (doc.id === keepUid) {
      console.log(`KEEP ${collectionName}/${doc.id}`);
      continue;
    }

    console.log(`${DRY_RUN ? "WOULD DELETE" : "DELETE"} ${collectionName}/${doc.id}`);

    if (!DRY_RUN) {
      batch.delete(doc.ref);
      ops++;
      deleted++;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }

  if (!DRY_RUN && ops > 0) {
    await batch.commit();
  }

  return deleted;
}

async function deleteAuthUsersExcept(keepUid) {
  let nextPageToken;
  let deleteQueue = [];

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);

    for (const user of result.users) {
      if (user.uid === keepUid) {
        console.log(`KEEP auth user ${user.uid} ${user.email || ""}`);
        continue;
      }

      console.log(`${DRY_RUN ? "WOULD DELETE" : "DELETE"} auth user ${user.uid} ${user.email || ""}`);
      deleteQueue.push(user.uid);
    }

    nextPageToken = result.pageToken;
  } while (nextPageToken);

  if (!DRY_RUN && deleteQueue.length) {
    for (let i = 0; i < deleteQueue.length; i += 1000) {
      const chunk = deleteQueue.slice(i, i + 1000);
      const result = await admin.auth().deleteUsers(chunk);
      console.log(`Deleted auth users: ${result.successCount}, failed: ${result.failureCount}`);

      if (result.failureCount > 0) {
        console.log(result.errors);
      }
    }
  }

  return deleteQueue.length;
}

async function main() {
  console.log("====================================");
  console.log(`KEEP_UID: ${KEEP_UID}`);
  console.log(`MODE: ${DRY_RUN ? "DRY RUN - no deletes" : "LIVE DELETE"}`);
  console.log("====================================");

  await deleteFirestoreDocsExcept("users", KEEP_UID);
  await deleteFirestoreDocsExcept("roles", KEEP_UID);

  await deleteAuthUsersExcept(KEEP_UID);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});