require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const config = require("./config");

const bot = new Telegraf(process.env.BOT_TOKEN);

const DB_FILE = "./database.json";

let db = {
  users: {},
  withdrawals: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    console.log("Database dibuat ulang.");
  }
}

function saveDB() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

function getUser(id) {
  id = String(id);

  if (!db.users[id]) {
    db.users[id] = {
      id,
      balance: config.START_BALANCE,
      referrals: 0,
      referredBy: null,
      createdAt: new Date().toISOString()
    };

    saveDB();
  }

  return db.users[id];
}

// ==========================
// CEK JOIN
// ==========================

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

// ==========================
// WAJIB JOIN
// ==========================

async function showJoin(ctx) {
  return ctx.reply(
    "🔒 AKSES TERBATAS\n\n" +
    "Silakan bergabung ke grup/channel resmi terlebih dahulu.\n\n" +
    "Setelah bergabung, tekan tombol \"Saya Sudah Bergabung\".",
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "📢 JOIN SEKARANG",
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

// ==========================
// DASHBOARD
// ==========================

async function dashboard(ctx, edit = false) {
  const member =
    await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user =
    getUser(ctx.from.id);

  const text =
    "🎉 *WELCOME TO CUAN REWARD BOT*\n\n" +
    "Platform referral dengan sistem saldo yang transparan.\n\n" +

    "📊 *STATISTIK AKUN ANDA*\n\n" +
    `🆔 ID User: \`${user.id}\`\n` +
    `💰 Saldo: *Rp ${user.balance.toLocaleString("id-ID")}*\n` +
    `👥 Referral: *${user.referrals} Orang*\n\n` +

    "ℹ️ *INFORMASI SISTEM*\n\n" +
    `🎁 Bonus Referral: *Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")} / User*\n` +
    `💳 Minimal WD: *Rp ${config.MIN_WITHDRAW.toLocaleString("id-ID")}*\n` +
    "⏱ Proses WD: 1-5 Menit (Otomatis)\n" +
    `👨‍💻 Admin: @${config.ADMIN_USERNAME}`;
     "💡 Klik menu *💰 Hasilkan Uang* di bawah
  untuk membagikan link referral kamu
  dan mulai menghasilkan!"

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
          "👨‍💻 Hubungi Admin",
          `https://t.me/${config.ADMIN_USERNAME}`
        )
      ]
    ]);

  if (edit) {
    try {
      return await ctx.editMessageText(
        text,
        {
          parse_mode: "Markdown",
          ...keyboard
        }
      );
    } catch {}
  }

  return ctx.reply(
    text,
    {
      parse_mode: "Markdown",
      ...keyboard
    }
  );
}

// ==========================
// START
// ==========================

bot.start(async (ctx) => {
  const args =
    ctx.message.text.split(" ");

  const referralCode =
    args[1];

  if (!(await isMember(ctx.from.id))) {
    return showJoin(ctx);
  }

  const user =
    getUser(ctx.from.id);

  if (
    referralCode &&
    referralCode !== String(ctx.from.id) &&
    !user.referredBy
  ) {
    const referrer =
      db.users[String(referralCode)];

    if (referrer) {
      user.referredBy =
        String(referralCode);

      referrer.referrals += 1;

      referrer.balance +=
        config.REFERRAL_BONUS;

      saveDB();

      await ctx.reply(
        "🎁 Referral berhasil diproses!"
      );
    }
  }

  return dashboard(ctx);
});

// ==========================
// CHECK JOIN
// ==========================

bot.action(
  "CHECK_JOIN",
  async (ctx) => {

    const member =
      await isMember(ctx.from.id);

    if (!member) {
      return ctx.answerCbQuery(
        "❌ Kamu belum bergabung.",
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery(
      "✅ Berhasil diverifikasi!"
    );

    return dashboard(
      ctx,
      true
    );
  }
);

// ==========================
// PROTEKSI SEMUA TOMBOL
// ==========================

bot.use(
  async (ctx, next) => {

    if (ctx.callbackQuery) {

      const action =
        ctx.callbackQuery.data;

      if (action !== "CHECK_JOIN") {

        const member =
          await isMember(
            ctx.from.id
          );

        if (!member) {

          try {
            await ctx.answerCbQuery(
              "🔒 Silakan join terlebih dahulu.",
              {
                show_alert: true
              }
            );
          } catch {}

          try {
            await showJoin(ctx);
          } catch {}

          return;
        }
      }
    }

    return next();
  }
);

// ==========================
// EARN
// ==========================

bot.action(
  "EARN",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    const me =
      await bot.telegram.getMe();

    const referralLink =
      `https://t.me/${me.username}?start=${user.id}`;

    return ctx.reply(
      "💰 *PROGRAM REFERRAL*\n\n" +
      `🎁 Bonus: *Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")} / Orang*\n\n` +
      "Undang teman menggunakan link referral kamu.\n\n" +
      "🔗 *Link Referral Kamu:*\n" +
      `\`${referralLink}\``,
      "💡 *Semakin banyak teman yang
      bergabung menggunakan link Anda,
      semakin besar saldo yang bisa Anda tarik!*",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
  "📤 Bagikan Link Referral",
  `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Yuk daftar melalui link referral saya!")}`
)
          ],
          [
            Markup.button.callback(
              "🏠 Dashboard",
              "DASHBOARD"
            )
          ]
        ])
      }
    );
  }
);

// ==========================
// DASHBOARD BUTTON
// ==========================

bot.action(
  "DASHBOARD",
  async (ctx) => {

    await ctx.answerCbQuery();

    return dashboard(
      ctx,
      true
    );
  }
);

// ==========================
// WITHDRAW
// ==========================

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
        "❌ *SALDO TIDAK MENCUKUPI*\n\n" +
        `💰 Saldo Anda: *Rp ${user.balance.toLocaleString("id-ID")}*\n` +
        `💳 Minimal WD: *Rp ${config.MIN_WITHDRAW.toLocaleString("id-ID")}*\n\n` +
        "Silakan kumpulkan saldo tambahan melalui menu Hasilkan Uang.",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "💰 Hasilkan Uang",
                "EARN"
              )
            ],
            [
              Markup.button.callback(
                "🏠 Dashboard",
                "DASHBOARD"
              )
            ]
          ])
        }
      );
    }

    return ctx.reply(
      "💳 *PENGAJUAN WITHDRAW*\n\n" +
      `Saldo: *Rp ${user.balance.toLocaleString("id-ID")}*\n\n` +
      "Hubungi admin untuk pengajuan WD.\n\n" +
      `🆔 ID User: \`${user.id}\`\n` +
      "💰 Nominal WD\n" +
      "📱 Nomor/Nama e-wallet\n\n" +
      "⚠️ Jangan kirim OTP, PIN, password, atau kode keamanan.",
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "👨‍💻 Hubungi Admin",
              `https://t.me/${config.ADMIN_USERNAME}`
            )
          ],
          [
            Markup.button.callback(
              "🏠 Dashboard",
              "DASHBOARD"
            )
          ]
        ])
      }
    );
  }
);

// ==========================
// HISTORY
// ==========================

bot.action(
  "HISTORY",
  async (ctx) => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const history =
      db.withdrawals.filter(
        x =>
          x.userId === userId
      );

    if (!history.length) {

      return ctx.reply(
        "📋 *RIWAYAT WITHDRAW*\n\n" +
        "Belum ada pengajuan withdraw.",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🏠 Dashboard",
                "DASHBOARD"
              )
            ]
          ])
        }
      );
    }

    let text =
      "📋 *RIWAYAT WITHDRAW*\n\n";

    history
      .slice(-10)
      .reverse()
      .forEach(
        (item, index) => {

          text +=
            `${index + 1}. Rp ${item.amount.toLocaleString("id-ID")}\n` +
            `Status: ${item.status}\n` +
            `Tanggal: ${item.date}\n\n`;
        }
      );

    return ctx.reply(
      text,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🏠 Dashboard",
              "DASHBOARD"
            )
          ]
        ])
      }
    );
  }
);

// ==========================
// ERROR
// ==========================

bot.catch((err) => {
  console.log(
    "BOT ERROR:",
    err.message
  );
});

// ==========================
// START BOT
// ==========================

bot.launch();

console.log(
  "✅ GLOBAL EARNING BOT AKTIF"
);

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
