export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64 } = req.body;

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          photo: imageBase64,
          caption: "Part Image"
        })
      }
    );

    const tgData = await tgRes.json();

   if (!tgData.ok) {
  console.log("Telegram Error:", tgData);

  return res.status(500).json({
    success: false,
    telegram: tgData
  });
}

    const fileId =
      tgData.result.photo[tgData.result.photo.length - 1].file_id;

    return res.status(200).json({
      success: true,
      fileId
    });

  } catch (e) {
  console.error(e);

  return res.status(500).json({
    success: false,
    error: e.message,
    stack: e.stack
  });
}
}
