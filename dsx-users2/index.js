const TAG = "dsx-users";
const VERSION = "1.1";
const port = process.env.PORT || 16040;
const databaseHost = process.env.DBHOST || "dsx-database";
const databasePort = process.env.DBPORT || 27017;
const databaseDisabled = process.env.DB_DISABLED === "true";
const adapterHost = process.env.ADAPTERHOST || "dsx-adapter";
const adapterPort = process.env.ADAPTERPORT || 6379;
const adapterDisabled = process.env.ADAPTER_DISABLED === "true";
const documentsCollectionName = "users";
const routingPrefix = "/users";
const model = "user";

const DsxModule = require("./DsxModule");
const dsxModule = new DsxModule(
  TAG,
  VERSION,
  port,
  databaseHost,
  databasePort,
  databaseDisabled,
  adapterHost,
  adapterPort,
  adapterDisabled,
  documentsCollectionName,
  routingPrefix,
  model
);
if (!databaseDisabled) dsxModule.initDB();
dsxModule.initRouting();

// Events //////////////////////////////////////////////////////////////////////////////////////////

dsxModule.io.on("connection", (socket) => {
  console.log(TAG, "New Connection", dsxModule.serverId, socket.id);
  socket.emit("d_server_id_i", dsxModule.serverId);

  socket.on("u_user_connect_rq", async (uuid) => {
    console.log(TAG, "u_user_connect_rq", uuid);
    socket.userId = uuid;
    socket.emit("d_user_connect_cf", uuid);
    const user = await dsxModule.getDocument(uuid);
    if (user !== null && user.connected === false) {
      const updateUser = { uuid, connected: true };
      const strUpdateUser = JSON.stringify(updateUser);
      console.log(TAG, "u_connect_user_rq strUpdateUser", strUpdateUser);
      socket.broadcast.emit("d_user_update_i", strUpdateUser);
      await dsxModule.saveDocument(updateUser);
    }
  });

  socket.on("u_user_create_i", async (user) => {
    socket.broadcast.emit("d_user_create_i", user);
    const jsonUser = JSON.parse(user);
    console.log(TAG, "u_user_create_i", user);
    await dsxModule.saveDocument(jsonUser);
  });

  socket.on("u_user_update_i", async (user) => {
    socket.broadcast.emit("d_user_update_i", user);
    const jsonUser = JSON.parse(user);
    console.log(TAG, "u_user_update_i", user, jsonUser);
    await dsxModule.updateDocument(jsonUser);
  });

  socket.on("u_user_delete_i", async (uuid) => {
    socket.broadcast.emit("d_user_delete_i", uuid);
    console.log(TAG, "u_user_delete_i", uuid);
    await dsxModule.deleteDocument(uuid);
  });

  socket.on("disconnect", async () => {
    console.log(TAG, "disconnect:", socket.userId);
    const user = await dsxModule.getDocument(socket.userId);
    if (user !== null) {
      const updateUser = { uuid: socket.userId, connected: false };
      const strUpdateUser = JSON.stringify(updateUser);
      console.log(TAG, "disconnect", strUpdateUser);
      socket.broadcast.emit("d_user_update_i", strUpdateUser);
      await dsxModule.saveDocument(updateUser);
    }
  });
});
