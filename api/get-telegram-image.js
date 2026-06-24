export default async function handler(req, res) {
  try {
    const fileId = req.query.fileId;

    if (!fileId) {
      return res.status(400).json({
        error: "fileId required"
      });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json(tgData);
    }

    const filePath = tgData.result.file_path;

    const imageUrl =
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    return res.redirect(imageUrl);

  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
}
