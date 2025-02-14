const fs = require("fs");
const path = require("path");
const http = require("http");
const Koa = require("koa");
const { koaBody } = require("koa-body");
const WS = require("ws");
const Router = require("koa-router");
const { v4: uuidv4 } = require("uuid");
const { format } = require("date-fns");
const cors = require("koa-cors");
const mime = require("mime-types");
const serve = require("koa-static");
const { promises: fsPromises } = require("fs");
const BASEURL = `http://localhost:9010`;

const app = new Koa();
const router = new Router();

const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const messageHistory = [];

const id = uuidv4();
messageHistory.push({
  id: id,
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

const id1 = uuidv4();
messageHistory.push({
  id: id1,
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

const id2 = uuidv4();

messageHistory.push({
  id: id2,
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

app.use(
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024,
    },
  }),
);

app.use(cors({ origin: "*" }));
app.use(serve(UPLOAD_DIR));
app.use(router.routes());

router.post("/upload", async (ctx) => {
  try {
    const file = ctx.request.files.file;

    if (!file) {
      ctx.status = 400;
      ctx.body = { error: "Файл не найден" };
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      ctx.status = 413;
      ctx.body = { error: "Размер файла превышает 100MB" };
      return;
    }

    const fileName = `${uuidv4()}${path.extname(file.originalFilename)}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const contentType = file.mimetype || "application/octet-stream";


    try {
      await fsPromises.rename(file.filepath, filePath);
    } catch (renameErr) {
      console.error("Ошибка переименования файла:", renameErr);
      ctx.status = 500;
      ctx.body = { error: "Ошибка сохранения файла: " + renameErr.message };
      return;
    }

    let fileReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        const stats = await fsPromises.stat(filePath);
        if (stats.size === file.size) {
          fileReady = true;
          break;
        }
      } catch (error) {
        console.error("Файл пока не доступен");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!fileReady) {
      console.error("Файл не успел записаться!");
      ctx.status = 500;
      ctx.body = { error: "Ошибка загрузки файла" };
      return;
    }

    const newMessage = {
      id: uuidv4(),
      contentType: contentType,
      content: BASEURL + `/uploads/${fileName}`,
      fileName: file.originalFilename,
      timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
    };

    messageHistory.push(newMessage);

    setTimeout(() => {
      wss.clients.forEach((client) => {
        if (client.readyState === WS.OPEN) {
          client.send(JSON.stringify({ type: "new_message", ...newMessage }));
        }
      });
    }, 300);

    ctx.body = {
      success: true,
      fileUrl: BASEURL + `/uploads/${fileName}`,
      contentType: contentType,
      fileName: file.originalFilename,
    };
  } catch (err) {
    console.error("Ошибка загрузки:", err);
    console.error("Стек ошибки загрузки:", err.stack);
    ctx.status = 500;
    ctx.body = { error: "Внутренняя ошибка сервера: " + err.message };
  }
});

router.get("/uploads/:filename", async (ctx) => {
  const filePath = path.join(UPLOAD_DIR, ctx.params.filename);

  if (fs.existsSync(filePath)) {
    const contentType =
      mime.lookup(ctx.params.filename) || "application/octet-stream";

    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    ctx.set("Content-Type", contentType);

    ctx.body = fs.createReadStream(filePath);
  } else {
    ctx.status = 404;
    ctx.body = "Файл не найден";
  }
});

const port = 9010;
const server = http.createServer(app.callback());
const wss = new WS.Server({ server });

wss.on("connection", (ws) => {
  console.log(messageHistory);

  ws.send(
    JSON.stringify({ type: "message_history", messages: messageHistory }),
  );

  ws.on("message", (data) => {
    const message = JSON.parse(data);
    switch (message.type) {
      case "send_message": {
        const { content, contentType = "text" } = message;
        const timeStamp = format(new Date(), "HH:mm dd.MM.yyyy");
        const id = uuidv4();
        const newMessage = { id, contentType, content, timeStamp };
        messageHistory.push(newMessage);
        wss.clients.forEach((client) => {
          if (client.readyState === WS.OPEN) {
            client.send(JSON.stringify({ type: "new_message", ...newMessage }));
          }
        });
        break;
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
