import { proto, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";

export async function useMongoDBAuthState(collection) {
  const writeData = async (data, id) => {
    return await collection.replaceOne(
      { _id: id },
      { _id: id, data: JSON.stringify(data, BufferJSON.replacer) },
      { upsert: true }
    );
  };

  const readData = async (id) => {
    try {
      const doc = await collection.findOne({ _id: id });
      if (!doc || !doc.data) return null;
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      await collection.deleteOne({ _id: id });
    } catch {}
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          const docs = await collection.find({ _id: { $in: ids.map(id => `${type}-${id}`) } }).toArray();
          for (const doc of docs) {
            try {
              let value = JSON.parse(doc.data, BufferJSON.reviver);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              const id = doc._id.replace(`${type}-`, "");
              data[id] = value;
            } catch {}
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
                operations.push({
                  replaceOne: {
                    filter: { _id: key },
                    replacement: { _id: key, data: JSON.stringify(value, BufferJSON.replacer) },
                    upsert: true
                  }
                });
              } else {
                operations.push({
                  deleteOne: {
                    filter: { _id: key }
                  }
                });
              }
            }
          }
          if (operations.length > 0) {
            await collection.bulkWrite(operations, { ordered: false });
          }
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
}
