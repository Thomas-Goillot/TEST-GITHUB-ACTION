const core_version = "1.3";
const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const socketio = require("socket.io");
const redisAdapter = require("@socket.io/redis-adapter");
const redis = require("redis");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

class DsxModule {
  constructor(
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
  ) {
    this.TAG = TAG;
    this.VERSION = VERSION;
    this.port = port;
    this.databaseDisabled = databaseDisabled;
    this.adapterHost = adapterHost;
    this.adapterPort = adapterPort;
    this.adapterDisabled = adapterDisabled;
    this.documentsCollectionName = documentsCollectionName;
    this.routingPrefix = routingPrefix;
    this.model = model;

    this.serverId =
      process.env.SERVER_ID || crypto.randomBytes(3).toString("hex");

    this.databaseUri =
      "mongodb://" +
      databaseHost +
      ":" +
      databasePort +
      "/dsx?retryWrites=true&w=majority";

    this.adapterUrl = "redis://" + this.adapterHost + ":" + this.adapterPort;

    const swaggerOptions = {
      swaggerDefinition: {
        openapi: "3.0.0",
        info: {
          title: "DSX " + this.model + " API",
          version: "1.0.0",
          description: "API for DSX " + this.model + " Management",
        },
      },
      apis: ["./swaggerDoc.js"],
    };

    const swaggerDocs = swaggerJSDoc(swaggerOptions);

    this.app = express();
    this.app.use(bodyParser.json());
    this.app.use(
      this.routingPrefix + "/docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocs)
    );
    this.server = http.createServer(this.app);
    this.io = new socketio.Server(this.server);

    if (!this.adapterDisabled) this.connectAdapter();
    else console.log(this.TAG, "Adapter is disabled");
    this.startServer();
  }

  connectAdapter() {
    const pubClient = redis.createClient({
      url: this.adapterUrl,
    });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (error) => {
      console.log("Adapter pubClient error", error);
    });
    subClient.on("error", (error) => {
      console.log("Adapter subClient error", error);
    });
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      this.io.adapter(redisAdapter(pubClient, subClient));
    });
    const adapter = this.io.of("/").adapter;
  }

  initDB() {
    this.connectDBWithRetry();
  }

  async connectDBWithRetry() {
    this.dbConnected = false;
    this.client = new MongoClient(this.databaseUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      //serverSelectionTimeoutMS: 2000,
    });

    const retryConnection = async () => {
      try {
        await this.client.connect();
        console.log(this.TAG, "Connected to DSX Database server");
        this.dbConnected = true;
        this.documentsCollection = this.client
          .db()
          .collection(this.documentsCollectionName);
      } catch (error) {
        console.error(
          this.TAG,
          "Failed to connect to DSX Database server:",
          error
        );
        this.client.close();
        setTimeout(retryConnection, 5000);
      }
    };

    await retryConnection();
  }

  async saveDocument(document) {
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "saveDocument DB not connected");
      return;
    }
    try {
      const result = await this.documentsCollection.updateOne(
        { uuid: document.uuid },
        { $set: document },
        { upsert: true }
      );
      console.log(this.TAG, "Document saved, document:", document);
    } catch (error) {
      console.error(this.TAG, "saveDocument DB error");
      return;
    }
  }

  async getDocuments() {
    console.log(this.TAG, "getDocuments");
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "getDocuments DB not connected");
      return [];
    }
    try {
      const cursor = this.documentsCollection.find();
      const documents = await cursor.toArray();
      console.log(this.TAG, "Documents extracted:", documents);
      return documents;
    } catch (error) {
      console.error(this.TAG, "getDocuments DB error");
      return [];
    }
  }

  async getDocument(uuid) {
    console.log(this.TAG, "getDocument", this.dbConnected);
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "getDocument DB not connected");
      return null;
    }
    try {
      console.log(this.TAG, "getDocument", uuid);
      const document = await this.documentsCollection.findOne({ uuid });
      return document;
    } catch (error) {
      console.error(this.TAG, "getDocument DB error");
      return null;
    }
  }

  async updateDocument(document) {
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "updateDocument DB not connected");
      return;
    }
    try {
      const { uuid, ...updates } = document;
      const updateObject = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== null) {
          updateObject[key] = value;
        }
      }
      console.log(this.TAG, "updateDocument updateObject", updateObject);
      const result = await this.documentsCollection.updateOne(
        { uuid },
        { $set: updateObject }
      );
      console.log(
        this.TAG,
        "updateDocument",
        `${result.matchedCount} document(s) matched the filter, ${result.modifiedCount} document(s) was/were updated, and ${result.upsertedCount} document(s) was/were inserted.`
      );
    } catch (error) {
      console.error(this.TAG, "updateDocument DB error");
      return;
    }
  }

  async deleteDocument(uuid) {
    console.log(this.TAG, "deleteDocument: ", uuid);
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "deleteDocument DB not connected");
      return;
    }
    try {
      const result = await this.documentsCollection.deleteOne({ uuid });
      console.log(
        this.TAG,
        `${result.deletedCount} document(s) was/were deleted.`
      );
    } catch (error) {
      console.error(this.TAG, "deleteDocument DB error");
      return;
    }
  }

  async deleteDocuments() {
    if (!this.dbConnected || this.databaseDisabled) {
      console.error(this.TAG, "deleteDocuments DB not connected");
      return;
    }
    try {
      const result = await this.documentsCollection.deleteMany({});
      console.log(this.TAG, `Deleted ${result.deletedCount} documents`);
    } catch (error) {
      console.error(this.TAG, "deleteDocuments DB error", error);
      return;
    }
  }

  startServer() {
    this.server.listen(this.port, () => {
      console.log(this.TAG, this.toString());
    });
  }

  initRouting() {
    this.app.post(this.routingPrefix + "/create", async (req, res) => {
      const document = req.body;
      await this.saveDocument(document);
      console.log(this.TAG, "POST /create", document);
      const strDocument = JSON.stringify(document);
      this.io.emit("d_" + this.model + "_create_i", strDocument);
      res.status(201).send(document);
    });

    this.app.get(this.routingPrefix + "/readall", async (req, res) => {
      const documents = await this.getDocuments();
      console.log(this.TAG, "GET /readall", this.model);
      res.send(documents);
    });

    this.app.get(this.routingPrefix + "/read/:uuid", async (req, res) => {
      const uuid = req.params.uuid;
      const document = await this.getDocument(uuid);
      console.log(this.TAG, "GET /read", uuid, document);
      res.send(document);
    });

    this.app.post(this.routingPrefix + "/update", async (req, res) => {
      const updateData = req.body;
      console.log(this.TAG, "POST /update", updateData);
      await this.saveDocument(updateData);
      const document = await this.getDocument(updateData.uuid);
      console.log(this.TAG, "POST /update", document);
      const strUpdateData = JSON.stringify(updateData);
      this.io.emit("d_" + this.model + "_update_i", strUpdateData);
      res.send(document);
    });

    this.app.delete(this.routingPrefix + "/delete/:uuid", async (req, res) => {
      const uuid = req.params.uuid;
      console.log(this.TAG, "DELETE /delete", uuid);
      await this.deleteDocument(uuid);
      this.io.emit("d_" + this.model + "_delete_i", uuid);
      res.send(uuid);
    });

    this.app.delete(this.routingPrefix + "/deleteall", async (req, res) => {
      console.log(this.TAG, "DELETE /deleteall");
      await this.deleteDocuments();
      this.io.emit("d_" + this.model + "_delete_all_i");
      res.send();
    });
  }

  toString() {
    return (
      "DSX SERVER ID: " +
      this.serverId +
      "\n\tPORT: " +
      this.port +
      "\n\tDATABASE: " +
      (this.databaseDisabled ? "Disabled" : this.databaseUri) +
      "\n\tADAPTER: " +
      (this.adapterDisabled ? "Disabled" : this.adapterUrl) +
      "\n\tVERSION: " +
      this.VERSION +
      " (core version: " +
      core_version +
      ")"
    );
  }
}

module.exports = DsxModule;
