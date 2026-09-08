require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");

const bot = new Telegraf(process.env.BOT_TOKEN);

const DB_FILE = "./database.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: {}, withdrawals: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: {}, withdrawals: [] };
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const db = loadDB();

function getUser(userId) {
  const id = String(userId);

  if (!db.users[id]) {
    db.users[id] = {
      id: userId,
      balance: config.START_BALANCE,
      referrals: 0,
      referredBy: null,
      createdAt: new Date().toISOString()
    };

    saveDB();
  }

  return db.users[id];
}

async function isMember(userId) {
  try {
    const member = await bot.telegram.getChatMember(
      config.CHANNEL,
      userId
    );

    return [
      "creator",
      "administrator",
      "member"
    ].includes(member.status);
  } catch (error) {
    console.log("Cek member gagal:", error.message);
    return false;
  }
}

function joinMessage() {
  return (
    "🔒 <b>AKSES TERBATAS</b>\n\n" +
    "Untuk menggunakan bot ini, silakan bergabung terlebih dahulu ke channel resmi kami.\n\n" +
    "Setelah bergabung, tekan tombol <b>Saya Sudah Bergabung</b>."
  );
}

function joinKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "📢 Join Channel",
        config.CHANNEL_LINK
      )
    ],
    [
      Markup.button.callback(
        "✅ Saya Sudah Bergabung",
        "CHECK_JOIN"
      )
    ]
  ]);
}

async function showJoin(ctx) {
  return ctx.reply(
    joinMessage(),
    {
      parse_mode: "HTML",
      ...joinKeyboard()
    }
  );
}

async function dashboard(ctx) {
  const member = await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user = getUser(ctx.from.id);

  const text =
    "🎉 <b>WELCOME TO CUAN REWARD BOT</b>\n\n" +
    "Platform referral dengan sistem saldo yang transparan.\n\n" +

    "📊 <b>STATISTIK AKUN ANDA</b>\n\n" +
    `🆔 ID User: <code>${user.id}</code>\n` +
    `💰 Saldo: <b>Rp ${user.balance.toLocaleString("id-ID")}</b>\n` +
    `👥 Referral: <b>${user.referrals} Orang</b>\n\n` +

    "ℹ️ <b>INFORMASI SISTEM</b>\n\n" +
    `🎁 Bonus Referral: <b>Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")} / User</b>\n` +
    `💳 Minimal WD: <b>Rp ${config.MIN_WITHDRAW.toLocaleString("id-ID")}</b>\n` +
    "⏱️ Proses WD: <b>Manual oleh admin</b>\n" +
    `👨‍💼 Admin: <b>@${config.ADMIN_USERNAME}</b>\n\n` +

    "💡 Klik menu <b>💰 Hasilkan Uang</b> di bawah untuk membagikan link referral kamu dan mulai menghasilkan!";

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "💰 Hasilkan Uang",
        "EARN"
      )
    ],
    [
      Markup.button.callback(
        "💳 Withdraw",
        "WITHDRAW"
      ),
      Markup.button.callback(
        "📋 Riwayat WD",
        "HISTORY"
      )
    ],
    [
      Markup.button.url(
        "👨‍💼 Hubungi Admin",
        `https://t.me/${config.ADMIN_USERNAME}`
      )
    ]
  ]);

  return ctx.reply(text, {
    parse_mode: "HTML",
    ...keyboard
  });
}

bot.start(async (ctx) => {
  const member = await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user = getUser(ctx.from.id);

  const startPayload =
    ctx.message.text.split(" ")[1];

  if (
    startPayload &&
    startPayload !== String(user.id) &&
    !user.referredBy
  ) {
    const referrerId = String(startPayload);
    const referrer = db.users[referrerId];

    if (referrer) {
      user.referredBy = referrerId;
      referrer.referrals += 1;
      referrer.balance += config.REFERRAL_BONUS;

      saveDB();

      await ctx.reply(
        `🎉 <b>Referral berhasil!</b>\n\n` +
        `Kamu bergabung melalui link referral.\n` +
        `Bonus referral diberikan kepada pemilik link sebesar <b>Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")}</b>.`,
        { parse_mode: "HTML" }
      );
    }
  }

  return dashboard(ctx);
});

bot.action("CHECK_JOIN", async (ctx) => {
  await ctx.answerCbQuery();

  const member = await isMember(ctx.from.id);

  if (!member) {
    return ctx.reply(
      "❌ Kamu belum terdeteksi bergabung.\n\nSilakan join channel terlebih dahulu lalu tekan tombol ini lagi."
    );
  }

  await ctx.reply(
    "✅ <b>Berhasil!</b>\n\nKamu sudah bergabung ke channel resmi.",
    { parse_mode: "HTML" }
  );

  return dashboard(ctx);
});

bot.action("DASHBOARD", async (ctx) => {
  await ctx.answerCbQuery();
  return dashboard(ctx);
});

bot.action("
