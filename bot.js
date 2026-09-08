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
// DASHBOARD
// ================================

async function dashboard(ctx) {

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

    "├ ⏱ Proses WD: Manual oleh admin\n" +

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
// START + REFERRAL
// ================================

bot.start(async (ctx) => {

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

      // Tandai agar tidak dihitung dua kali
      user.referredBy =
        referrerId;

      // Tambah jumlah referral
      referrer.referrals += 1;

      // Tambah bonus
      referrer.balance +=
        config.REFERRAL_BONUS;

      saveDB();

      // ==========================
      // NOTIFIKASI PENGUNDANG
      // ==========================

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

          "✅ Bonus sudah masuk ke saldo kamu."

        );

      } catch (error) {

        console.log(
          "Gagal mengirim notifikasi referral:",
          error.message
        );

      }

      await ctx.reply(

        "🎉 SELAMAT DATANG DI CUAN REWARD!\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "✅ Kamu berhasil bergabung melalui\n" +
        "link referral.\n\n" +

        "🎁 Referral berhasil tercatat.\n\n" +

        "🏠 Silakan gunakan menu di bawah."

      );
    }

  } else {

    await ctx.reply(

      "🎉 SELAMAT DATANG DI CUAN REWARD!\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "✅ Akun kamu berhasil terdaftar.\n\n" +

      "💡 Gunakan link referral kamu\n" +
      "untuk mengundang teman.\n\n" +

      "🏠 Silakan gunakan menu di bawah."

    );
  }

  return dashboard(ctx);
});

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

    const text =
      "💸 PROGRAM REFERRAL GLOBAL EARNING\n" +
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
