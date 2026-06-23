export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64 } = req.body;

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const formData = new FormData();

    const base64Data = imageBase64.split(',')[1];

    const buffer = Buffer.from(base64Data, 'base64');

    const blob = new Blob([buffer], {
      type: 'image/jpeg'
    });

    formData.append(
      "photo",
      blob,
      "part.jpg"
    );

    formData.append(
      "chat_id",
      CHAT_ID
    );

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: formData
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
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
      error: e.message
    });
  }
}
