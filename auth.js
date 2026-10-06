import { proto, initAuthCreds } from "@whiskeysockets/baileys";

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
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
}

const BufferJSON = {
  replacer: (k, v) => {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array || v?.type === "Buffer") {
      return { type: "Buffer", data: Array.from(v?.data || v) };
    }
    return v;
  },
  reviver: (k, v) => {
    if (
      typeof v === "object" &&
      v !== null &&
      (v.type === "Buffer" || Array.isArray(v.data)) &&
      Array.isArray(v.data)
    ) {
      return Buffer.from(v.data);
    }
    return v;
  }
};

