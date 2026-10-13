import { proto, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";

export async function useMongoDBAuthState(collection) {
  const localCache = new Map();

  const writeData = async (data, id) => {
    try {
      localCache.set(id, data);
      await collection.replaceOne(
        { _id: id },
        { _id: id, data: JSON.stringify(data, BufferJSON.replacer) },
        { upsert: true }
      );
    } catch (e) {
      console.error(`[AUTH WRITE ERR - ${id}]:`, e.message);
    }
  };

  const readData = async (id) => {
    try {
      if (localCache.has(id)) return localCache.get(id);
      const doc = await collection.findOne({ _id: id });
      if (!doc?.data) return null;
      const parsed = JSON.parse(doc.data, BufferJSON.reviver);
      localCache.set(id, parsed);
      return parsed;
    } catch {
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      localCache.delete(id);
      await collection.deleteOne({ _id: id });
    } catch (_) {}
  };

  const creds = (await readData("creds")) || initAuthCreds();
  localCache.set("creds", creds);

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          const missingIds = [];

          for (const id of ids) {
            const key = `${type}-${id}`;
            if (localCache.has(key)) {
              let val = localCache.get(key);
              if (type === "app-state-sync-key" && val) {
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              data[id] = val;
            } else {
              missingIds.push({ id, key });
            }
          }

          if (missingIds.length > 0) {
            const keysToFetch = missingIds.map(m => m.key);
            const docs = await collection.find({ _id: { $in: keysToFetch } }).toArray();

            for (const doc of docs) {
              try {
                let value = JSON.parse(doc.data, BufferJSON.reviver);
                localCache.set(doc._id, value);
                if (type === "app-state-sync-key" && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                const id = doc._id.replace(`${type}-`, "");
                data[id] = value;
              } catch (_) {}
            }
          }

          return data;
        },
        set: async (data) => {
          const operations = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                localCache.set(key, value);
                operations.push({
                  replaceOne: {
                    filter: { _id: key },
                    replacement: { _id: key, data: JSON.stringify(value, BufferJSON.replacer) },
                    upsert: true
                  }
                });
              } else {
                localCache.delete(key);
                operations.push({
                  deleteOne: { filter: { _id: key } }
                });
              }
            }
          }
          if (operations.length > 0) {
            await collection.bulkWrite(operations, { ordered: false }).catch(() => {});
          }
        }
      }
    },
    saveCreds: () => writeData(creds, "creds"),
    clearSession: async () => {
      try {
        localCache.clear();
        await collection.drop().catch(() => {});
      } catch (_) {}
    }
  };
}
