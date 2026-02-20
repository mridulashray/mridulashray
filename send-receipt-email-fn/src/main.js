const sdk = require("node-appwrite");
const nodemailer = require("nodemailer");

module.exports = async function (context) {
  const req = context.req;
  const res = context.res;

  try {
    // Appwrite Node 22 runtime sends data on req.body / req.bodyRaw; keep fallback to req.payload
    let rawBody = "";
    if (typeof req.bodyRaw === "string" && req.bodyRaw.trim()) {
      rawBody = req.bodyRaw;
    } else if (typeof req.body === "string" && req.body.trim()) {
      rawBody = req.body;
    } else if (req.payload) {
      rawBody = req.payload;
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};

    const { donorName, donorEmail, receiptFileId, donationId } = payload;

    if (!donorEmail || !receiptFileId) {
      throw new Error("Missing donorEmail or receiptFileId in payload");
    }

    console.log("Sending receipt email to:", donorEmail, "for donation:", donationId);

    const endpoint =
      process.env.APPWRITE_FUNCTION_ENDPOINT ||
      process.env.APPWRITE_ENDPOINT ||
      "https://sgp.cloud.appwrite.io/v1";

    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const storage = new sdk.Storage(client);

    console.log("Downloading receipt PDF from bucket:", process.env.BUCKET_ID);
    const pdfData = await storage.getFileDownload(
      process.env.BUCKET_ID,
      receiptFileId
    );

    // Ensure Nodemailer receives a Node Buffer, not an ArrayBuffer
    const pdfBuffer = Buffer.isBuffer(pdfData)
      ? pdfData
      : Buffer.from(pdfData); // Appwrite SDK may return ArrayBuffer

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const name = donorName || "Friend";
    const fromAddress = `${process.env.EMAIL_FROM_NAME || "Mridulashray"} <${process.env.EMAIL_FROM}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: donorEmail,
      subject: "Your Donation Receipt – Mridulashray",
      text: `Dear ${name},

Thank you for your generous contribution to Mridulashray.

Please find your donation receipt attached as a PDF.

Warm regards,
Mridulashray Team`,
      attachments: [
        {
          filename: `donation-receipt-${donationId || "receipt"}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    console.log("Brevo response:", info);
    return context.res.json({ ok: true, messageId: info.messageId || null });
  } catch (err) {
    console.error("send-receipt-email error:", err);
    return context.res.json({ ok: false, error: err.message }, 500);
  }
};