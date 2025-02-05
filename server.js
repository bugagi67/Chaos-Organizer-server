const http = require("http");
const Koa = require("koa");
const { koaBody } = require("koa-body");
const WS = require("ws");
const Router = require("koa-router");
const { v4: uuidv4 } = require("uuid");
const { format } = require("date-fns");

const app = new Koa();
const router = new Router();

const messageHistory = new Map();

messageHistory.set(`${uuidv4()}`, {
  id: uuidv4(),
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

messageHistory.set(`${uuidv4()}`, {
  id: uuidv4(),
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

messageHistory.set(`${uuidv4()}`, {
  id: uuidv4(),
  contentType: "text",
  content: "GHbdt",
  timeStamp: format(new Date(), "HH:mm dd.MM.yyyy"),
});

app.use(
  koaBody({
    urlencoded: true,
  })
);

router.get("/1", (ctx) => {
  ctx.body = "Сервер запущен";
  console.log("Сервер запущен");
  console.log(messageHistory);
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());

const wss = new WS.Server({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case "get_history": {
        ws.send(
          JSON.stringify({ type: "message_history", messages: messageHistory })
        );
        break;
      }
      case "send_message": {
        const { content, contentType } = message;
        const timeStamp = format(new Date(), "HH:mm dd.MM.yyyy");
        const id = uuidv4();

        const outgoingMessage = JSON.stringify({
          type: "new_message",
          id,
          timeStamp,
          content,
        });

        messageHistory.set(`${id}`, { id, contentType, content, timeStamp });

        ws.send(outgoingMessage);
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
