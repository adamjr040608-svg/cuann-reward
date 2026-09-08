require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");

const bot = new Telegraf(process.env.BOT_TOKEN);

const DB_FILE = "./database.json";

// ================================
// DATABASE
// ================================

let db = {
  users: {},
  withdrawals: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );
  } catch (error) {
    console.log("Database tidak bisa dibaca.");
  }
}

function saveDB() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

// ================================
// USER
// ================================

function getUser(userId) {
  const id = String(userId);

  if (!db.users[id]) {
    db.users[id] = {
      id: id,
      balance: config.START_BALANCE,
      referrals: 0,
      referredBy: null
    };

    saveDB();
  }

  return db.users[id];
}

// ================================
// CEK MEMBER CHANNEL
// ================================

async function isMember(userId) {
  try {
    const member =
      await bot.telegram.getChatMember(
        config.CHANNEL,
        userId
      );

    return [
      "creator",
      "administrator",
      "member"
    ].includes(member.status);

  } catch (error) {
    console.log(
      "Cek member gagal:",
      error.message
    );

    return false;
  }
}

// ================================
// JOIN CHANNEL
// ================================

async function showJoin(ctx) {
  return ctx.reply(
    "🔐 AKSES TERBATAS\n" +
    "━━━━━━━━━━━━━━━━━━━━\n\n" +

    "📢 Silakan bergabung ke channel resmi\n" +
    "terlebih dahulu untuk menggunakan bot.\n\n" +

    "Setelah bergabung, tekan tombol\n" +
    "✅ Saya Sudah Bergabung.",

    Markup.inlineKeyboard([
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
    ])
  );
}

// ================================
// DASHBOARD
// ================================

async function dashboard(ctx) {

  const member =
    await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user =
    getUser(ctx.from.id);

  const text =
    "🎉 WELCOME TO CUAN REWARD BOT\n" +
    "━━━━━━━━━━━━━━━━━━━━\n\n" +

    "Platform referral terpercaya untuk mendapatkan\n" +
    "penghasilan tambahan dengan mudah dan transparan.\n\n" +

    "📊 STATISTIK AKUN ANDA\n" +
    "│\n" +
    "├ 👤 ID User: " +
    user.id +
    "\n" +

    "├ 💰 Saldo: Rp " +
    user.balance.toLocaleString("id-ID") +
    "\n" +

    "└ 👥 Referral: " +
    user.referrals +
    " Orang\n\n" +

    "ℹ️ INFORMASI SISTEM\n" +
    "│\n" +

    "├ 🎁 Bonus Referral: Rp " +
    config.REFERRAL_BONUS.toLocaleString("id-ID") +
    " / User\n" +

    "├ 💳 Minimal WD: Rp " +
    config.MIN_WITHDRAW.toLocaleString("id-ID") +
    "\n" +

    "├ ⏱ Proses WD: 1-5 Menit (Otomatis)\n" +

    "└ 👨‍💼 Admin: @" +
    config.ADMIN_USERNAME +
    "\n\n" +

    "━━━━━━━━━━━━━━━━━━━━\n" +

    "💡 Klik menu 💰 Hasilkan Uang di bawah\n" +
    "untuk membagikan link referral kamu dan\n" +
    "mulai menghasilkan!";

  const keyboard =
    Markup.inlineKeyboard([

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
          "https://t.me/" +
          config.ADMIN_USERNAME
        )
      ]

    ]);

  return ctx.reply(
    text,
    keyboard
  );
}

// ================================
// START
// ================================

bot.start(async (ctx) => {

  const member =
    await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user =
    getUser(ctx.from.id);

  const startPayload =
    ctx.startPayload || "";

  // ==============================
  // REFERRAL
  // ==============================

  if (
    startPayload &&
    startPayload !== String(ctx.from.id) &&
    !user.referredBy
  ) {

    const referrerId =
      String(startPayload);

    const referrer =
      db.users[referrerId];

    if (referrer) {

      user.referredBy =
        referrerId;

      referrer.referrals += 1;

      referrer.balance +=
        config.REFERRAL_BONUS;

      saveDB();

      // ============================
      // NOTIFIKASI PENGUNDANG
      // ============================

      try {

        await bot.telegram.sendMessage(

          referrerId,

          "🎉 REFERRAL BERHASIL!\n" +
          "━━━━━━━━━━━━━━━━━━━━\n\n" +

          "👤 Teman baru berhasil bergabung\n" +
          "melalui link referral kamu.\n\n" +

          "🎁 Bonus Referral: Rp " +
          config.REFERRAL_BONUS.toLocaleString("id-ID") +
          "\n\n" +

          "💰 Saldo sekarang: Rp " +
          referrer.balance.toLocaleString("id-ID") +
          "\n" +

          "👥 Total Referral: " +
          referrer.referrals +
          " Orang\n\n" +

          "💡 Ajak lebih banyak teman untuk\n" +
          "mendapatkan bonus referral."

        );

      } catch (error) {

        console.log(
          "Gagal mengirim notifikasi:",
          error.message
        );

      }

      await ctx.reply(

        "✅ PENDAFTARAN BERHASIL!\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "👤 Kamu berhasil bergabung\n" +
        "melalui link referral.\n\n" +

        "🎁 Referral berhasil tercatat.\n\n" +

        "🏠 Silakan gunakan menu di bawah."

      );
    }
  }

  return dashboard(ctx);
});

// ================================
// CEK JOIN
// ================================

bot.action(
  "CHECK_JOIN",
  async (ctx) => {

    await ctx.answerCbQuery();

    const member =
      await isMember(ctx.from.id);

    if (!member) {

      return ctx.reply(

        "❌ BELUM TERDETEKSI\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "Silakan bergabung ke channel resmi\n" +
        "kemudian tekan tombol ini lagi."

      );
    }

    return dashboard(ctx);
  }
);

// ================================
// PROTEKSI TOMBOL
// ================================

bot.use(
  async (ctx, next) => {

    if (
      ctx.callbackQuery &&
      ctx.callbackQuery.data !==
      "CHECK_JOIN"
    ) {

      const member =
        await isMember(ctx.from.id);

      if (!member) {
        return showJoin(ctx);
      }
    }

    return next();
  }
);

// ================================
// HASILKAN UANG / REFERRAL
// ================================

bot.action(
  "EARN",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    const me =
      await bot.telegram.getMe();

    const referralLink =
      "https://t.me/" +
      me.username +
      "?start=" +
      user.id;

    const shareLink =
      "https://t.me/share/url?url=" +
      encodeURIComponent(referralLink) +
      "&text=" +
      encodeURIComponent(
        "Yuk daftar melalui link referral saya!"
      );

    // FOTO KE-2
    const text =
      "💸 PROGRAM REFERRAL CUAN REWARD\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "Bagikan link referral unik Anda kepada\n" +
      "teman atau ke media sosial untuk\n" +
      "mendapatkan penghasilan tambahan secara\n" +
      "instan!\n\n" +

      "🎁 Bonus Referral: Rp " +
      config.REFERRAL_BONUS.toLocaleString("id-ID") +
      " / Orang\n\n" +

      "🔗 Link Referral Anda:\n" +
      referralLink +
      "\n\n" +

      "💡 Semakin banyak teman yang bergabung\n" +
      "menggunakan link Anda, semakin besar\n" +
      "saldo yang bisa Anda tarik!\n\n" +

      "👇 Klik tombol Bagikan Link Referral di\n" +
      "bawah untuk membagikan link Anda.";

    return ctx.reply(

      text,

      Markup.inlineKeyboard([

        [
          Markup.button.url(
            "📤 Bagikan Link Referral",
            shareLink
          )
        ],

        [
          Markup.button.callback(
            "🏠 Dashboard",
            "DASHBOARD"
          )
        ]

      ])
    );
  }
);

// ================================
// DASHBOARD BUTTON
// ================================

bot.action(
  "DASHBOARD",
  async (ctx) => {

    await ctx.answerCbQuery();

    return dashboard(ctx);
  }
);

// ================================
// WITHDRAW
// ================================

bot.action(
  "WITHDRAW",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    if (
      user.balance <
      config.MIN_WITHDRAW
    ) {

      return ctx.reply(

        "❌ SALDO TIDAK MENCUKUPI\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "│ 💰 Saldo Anda: Rp " +
        user.balance.toLocaleString("id-ID") +
        "\n" +

        "│ 💳 Minimal WD: Rp " +
        config.MIN_WITHDRAW.toLocaleString("id-ID") +
        "\n\n" +

        "💡 Silakan kumpulkan saldo tambahan\n" +
        "melalui menu 💰 Hasilkan Uang."

      );
    }

    return ctx.reply(

      "💳 PENGAJUAN WITHDRAW\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "│ 💰 Saldo: Rp " +
      user.balance.toLocaleString("id-ID") +
      "\n" +

      "│ 💳 Minimal WD: Rp " +
      config.MIN_WITHDRAW.toLocaleString("id-ID") +
      "\n\n" +

      "📩 Silakan hubungi admin untuk\n" +
      "proses withdraw.\n\n" +

      "│ 🆔 ID User: " +
      user.id +
      "\n" +

      "│ 👨‍💼 Admin: @" +
      config.ADMIN_USERNAME +
      "\n\n" +

      "⚠️ Jangan pernah mengirim OTP, PIN,\n" +
      "atau password kepada siapa pun."

    );
  }
);

// ================================
// RIWAYAT WD
// ================================

bot.action(
  "HISTORY",
  async (ctx) => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const history =
      db.withdrawals.filter(
        item =>
          String(item.userId) ===
          userId
      );

    if (history.length === 0) {

      return ctx.reply(

        "📋 RIWAYAT WITHDRAW\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "│ Belum ada riwayat withdraw."

      );
    }

    let text =
      "📋 RIWAYAT WITHDRAW\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n";

    history.forEach(
      (item, index) => {

        text +=
          "│ " +
          (index + 1) +
          ". Rp " +
          Number(item.amount)
            .toLocaleString("id-ID") +
          "\n" +

          "│ Status: " +
          item.status +
          "\n\n";
      }
    );

    return ctx.reply(text);
  }
);

// ================================
// ERROR HANDLER
// ================================

bot.catch((error) => {

  console.log(
    "BOT ERROR:",
    error
  );

});

// ================================
// START BOT
// ================================

bot.launch();

console.log(
  "✅ CUAN REWARD BOT AKTIF"
);

// ================================
// STOP GRACEFULLY
// ================================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
