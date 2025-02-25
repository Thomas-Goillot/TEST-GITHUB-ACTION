const TAG = "dsx-users";
const port = process.env.PORT || 16040;
const databaseUri = "mongodb://localhost:27017/dsx?retryWrites=true&w=majority";
const adapterHost = "localhost";
const adapterPort = 6379;
const documentsCollectionName = "users";
const routingPrefix = "/users";

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const crypto = require("crypto");
const { channel } = require("diagnostics_channel");
const serverId = process.env.SERVER_ID || crypto.randomBytes(3).toString("hex");
const { MongoClient, ObjectId } = require("mongodb");
const { v4: uuidv4 } = require("uuid");

// Adapter /////////////////////////////////////////////////////////////////////////////////////////

const pubClient = createClient({ host: adapterHost, port: adapterPort });

const subClient = pubClient.duplicate();

pubClient.on('error', (error)=>{
  console.error(TAG,"pubClient can't reach adapter");
});

subClient.subscribe;

subClient.on('error', (error)=>{
  console.error(TAG,"subClient can't reach adapter");
});

io.adapter(createAdapter(pubClient, subClient));

const adapter = io.of("/").adapter;

// Database ////////////////////////////////////////////////////////////////////////////////////////

var dbConnected = false;

const client = new MongoClient(databaseUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  //serverSelectionTimeoutMS: 2000,
});

async function connectDBWithRetry() {
  try {
    await client.connect();
    console.log(TAG,"Connected to DSX Database server");
    dbConnected = true;
  } catch (error) {
    console.error(TAG,"Failed to connect to DSX Database server:", error);
    setTimeout(connectDBWithRetry, 5000);
  }

}

connectDBWithRetry();

const documentsCollection = client.db().collection(documentsCollectionName);

async function saveDocument(document) {
  if (!dbConnected) {
    console.error(TAG,"saveDocument DB not connected");
    return;
  }
  const result = await documentsCollection.updateOne(
    { uuid: document.uuid },
    { $set: document },
    { upsert: true }
  );
  if (result.upsertedCount === 1) {
    console.log(TAG, `Document inserted with _id: ${result.upsertedId._id}`);
  } else {
    console.log(TAG, `Document updated with _id: ${document._id}`);
  }
}

async function getDocuments() {
  console.log(TAG,"getDocuments");
  if (!dbConnected) {
    console.error(TAG,"getDocuments DB not connected");
    return [];
  }
  const cursor = documentsCollection.find();
  const documents = await cursor.toArray();
  console.log(TAG, "Documents extracted:", documents);
  return documents;
}

async function getDocument(uuid) {
  console.log(TAG,"getDocument",dbConnected);
  if (!dbConnected) {
    console.error(TAG,"getDocument DB not connected");
    return null;
  }
  console.log(TAG,"getDocument",uuid);
  const document = await documentsCollection.findOne({ uuid });
  return document;
}

async function updateDocument(document) {
  if (!dbConnected) {
    console.error(TAG,"updateDocument DB not connected");
    return;
  }
  const { uuid, ...updates } = document;
  const updateObject = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) {
      updateObject[key] = value;
    }
  }
  console.log("updateDocument updateObject", updateObject);
  const result = await documentsCollection.updateOne(
    { uuid },
    { $set: updateObject }
  );
  console.log(
    "updateDocument",
    `${result.matchedCount} document(s) matched the filter, ${result.modifiedCount} document(s) was/were updated, and ${result.upsertedCount} document(s) was/were inserted.`
  );
}

async function deleteDocument(uuid) {
  console.log(TAG, "deleteDocument: ", uuid);
  if (!dbConnected) {
    console.error(TAG,"deleteDocument DB not connected");
    return;
  }
  const result = await documentsCollection.deleteOne({ uuid });
  console.log(TAG, `${result.deletedCount} document(s) was/were deleted.`);
}

async function deleteDocuments() {
  if (!dbConnected) {
    console.error(TAG,"deleteDocuments DB not connected");
    return;
  }
  const result = await documentsCollection.deleteMany({});
  console.log(TAG, `Deleted ${result.deletedCount} documents`);
}

// Start Server ////////////////////////////////////////////////////////////////////////////////////

server.listen(port, () => {
  console.log(TAG, "Server listening at port: ", port);
  console.log(TAG, "Server Id: ", serverId);
});

// const defaultUsers = [
//   {
//     uuid: "ant",
//     avatar: "ic_user_ant_24.png",
//   },
//   {
//     uuid: "captain",
//     avatar: "ic_user_captain_24.png",
//   },
//   {
//     uuid: "iron",
//     avatar: "ic_user_iron_24.png",
//   },
// ];

// (async () => {
//   let users = await getDocuments();
//   if (users.length === 0) {
//     console.log("length:" + users.length);
//     defaultUsers.forEach(async (user) => await saveDocument(user));
//   }
//   users = await getDocuments();
//   console.log("Documents: ", users);
// })();

// Routing /////////////////////////////////////////////////////////////////////////////////////////

app.post(routingPrefix + "/user", async (req, res) => {
  const document = req.body;
  console.log("POST /user", req.body);
  await saveDocument(document);
  console.log("POST /user", document);
  const strDocument = JSON.stringify(document);
  io.emit("d_user_create_i", strDocument);
  res.status(201).send(document);
});

app.get(routingPrefix + "/users", async (req, res) => {
  const documents = await getDocuments();
  console.log("GET /users");
  res.send(documents);
});

app.get(routingPrefix + "/user/:uuid", async (req, res) => {
  const uuid = req.params.uuid;
  const document = await getDocument(uuid);
  console.log("GET /user/:uuid", uuid, document);
  res.send(document);
});

app.post(routingPrefix + "/update", async (req, res) => {
  const updateData = req.body;
  console.log("POST /update", updateData);
  await updateDocument(updateData);
  const document = await getDocument(updateData.uuid);
  console.log("POST /update", document);
  const strUpdateData = JSON.stringify(updateData);
  io.emit("d_user_update_i", strUpdateData);
  res.send(document);
});

app.delete(routingPrefix + "/delete/:uuid", async (req, res) => {
  const uuid = req.params.uuid;
  console.log("DELETE /delete/:uuid", uuid);
  await deleteDocument(uuid);
  io.emit("d_user_delete_i", uuid);
  res.send(uuid);
});

app.delete(routingPrefix + "/deleteall", async (req, res) => {
  console.log("DELETE /deleteall");
  await deleteDocuments();
  io.emit("d_users_delete_all_i");
  res.send();
});

// Events //////////////////////////////////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  console.log("New Connection", serverId, socket.id);
  socket.emit("d_server_id_i", serverId);

  socket.on("u_user_connect_rq", async (uuid) => {
    console.log(TAG, "u_user_connect_rq", uuid);
    socket.userId = uuid;
    const user = await getDocument(uuid);
    if (user !== null && user.connected === false) {
      const result = await documentsCollection.updateOne(
        { uuid },
        { $set: { connected: true } }
      );
      console.log(TAG, "u_user_connect_rq user:", user);
      const updateUser = { uuid, connected: true };
      const strUpdateUser = JSON.stringify(updateUser);
      console.log(TAG, "u_connect_user_rq strUpdateUser", strUpdateUser);
      socket.broadcast.emit("d_user_update_i", strUpdateUser);
    }
    socket.emit("d_user_connect_cf", uuid);
  });

  socket.on("u_user_create_i", async (user) => {
    const jsonUser = JSON.parse(user);
    await saveDocument(jsonUser);
    const strUser = JSON.stringify(jsonUser);
    socket.broadcast.emit("d_user_create_i", strUser);
  });

  socket.on("u_user_update_i", async (user) => {
    const jsonUser = JSON.parse(user);
    console.log("u_user_update_i", user, jsonUser);
    await updateDocument(jsonUser);
    socket.broadcast.emit("d_user_update_i", user);
  });

  socket.on("u_user_delete_i", async (uuid) => {
    await deleteDocument(uuid);
    socket.broadcast.emit("d_user_delete_i", uuid);
  });

  socket.on("disconnect", async () => {
    console.log(TAG, "disconnect:", socket.userId);
    const user = await getDocument(socket.userId);
    if (user !== null) {
      const result = await documentsCollection.updateOne(
        { uuid: socket.userId },
        { $set: { connected: false } }
      );
      console.log(TAG, "disconnect:", user);
      const updateUser = { uuid: socket.userId, connected: false };
      const strUpdateUser = JSON.stringify(updateUser);
      console.log(TAG, "disconnect", strUpdateUser);
      socket.broadcast.emit("d_user_update_i", strUpdateUser);
    }
  });
});
