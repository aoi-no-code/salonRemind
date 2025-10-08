import * as line from "@line/bot-sdk"

const config: line.ClientConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
}

export const lineClient = new line.Client(config)
