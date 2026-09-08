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
  "🎉 WELCOME TO CUAN REWARD BOT\n" +
  "━━━━━━━━━━━━━━━━━━━━\n\n" +

  "Platform terpercaya untuk mendapatkan penghasilan harian dengan cepat dan aman.\n\n" +

  "📊 STATISTIK AKUN ANDA\n" +
  "│\n" +
  `├ 🆔 ID User: ${user.id}\n` +
  `├ 💰 Saldo: Rp ${user.balance.toLocaleString("id-ID")}\n` +
  `└ 👥 Referral: ${user.referrals} Orang\n\n` +

  "ℹ️ INFORMASI SISTEM\n" +
  "│\n" +
  `├ 🎁 Bonus Referral: Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")} / User\n` +
  `├ 💳 Minimal WD: Rp ${config.MIN_WITHDRAW.toLocaleString("id-ID")}\n` +
  "├ ⏱️ Proses WD: Manual oleh admin\n" +
  `└ 👨‍💼 Admin: @${config.ADMIN_USERNAME}\n\n` +

  "━━━━━━━━━━━━━━━━━━━━\n" +
  "💡 Klik menu 💰 Hasilkan Uang di bawah\n" +
  "untuk membagikan link referral kamu dan\n" +
  "mulai menghasilkan!";

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

bot.action("EARN", async (ctx) => {
  await ctx.answerCbQuery();

  const member = await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user = getUser(ctx.from.id);

  const me = await bot.telegram.getMe();

  const referralLink =
    `https://t.me/${me.username}?start=${user.id}`;

  const text =
    "💸 <b>PROGRAM REFERRAL GLOBAL EARNING</b>\n\n" +
    "━━━━━━━━━━━━━━━━━━━━\n\n" +
    "Bagikan link referral unik Anda kepada teman atau ke media sosial untuk mendapatkan penghasilan tambahan secara instan!\n\n" +
    `🎁 <b>Bonus Referral: Rp ${config.REFERRAL_BONUS.toLocaleString("id-ID")} / Orang</b>\n\n` +
    "🔗 <b>Link Referral Anda:</b>\n" +
    `<code>${referralLink}</code>\n\n` +
    "💡 <i>Semakin banyak teman yang bergabung menggunakan link Anda, semakin besar saldo yang bisa Anda tarik!</i>\n\n" +
    "👇 Klik tombol <b>Bagikan Link Referral</b> di bawah untuk membagikan link Anda.";

  return ctx.reply(text, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.url(
          "📤 Bagikan Link Referral",
          `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Yuk bergabung melalui link referral saya!")}`
        )
      ],
      [
        Markup.button.callback(
          "🏠 Dashboard",
          "DASHBOARD"
        )
      ]
    ])
  });
});

bot.action("WITHDRAW", async (ctx) => {
  await ctx.answerCbQuery();

  const member = await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const user = getUser(ctx.from.id);

  if (user.balance < config.MIN_WITHDRAW) {
    return ctx.reply(
      "❌ <b>SALDO TIDAK MENCUKUPI</b>\n\n" +
      `💰 Saldo Anda: <b>Rp ${user.balance.toLocaleString("id-ID")}</b>\n` +
      `💳 Minimal WD: <b>Rp ${config.MIN_WITHDRAW.toLocaleString("id-ID")}</b>\n\n` +
      "Silakan kumpulkan saldo tambahan melalui menu <b>Hasilkan Uang</b>.",
      {
        parse_mode: "HTML",
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
    "💳 <b>MENU WITHDRAW</b>\n\n" +
    `Saldo Anda: <b>Rp ${user.balance.toLocaleString("id-ID")}</b>\n\n` +
    "Untuk melakukan withdraw, hubungi admin resmi.\n\n" +
    `👨‍💼 Admin: @${config.ADMIN_USERNAME}\n\n` +
    "⚠️ Jangan pernah memberikan OTP, PIN, password, atau kode keamanan kepada siapa pun.",
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "👨‍💼 Hubungi Admin",
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
});

bot.action("HISTORY", async (ctx) => {
  await ctx.answerCbQuery();

  const member = await isMember(ctx.from.id);

  if (!member) {
    return showJoin(ctx);
  }

  const userId = String(ctx.from.id);

  const history = db.withdrawals.filter(
    (item) => String(item.userId) === userId
  );

  if (history.length === 0) {
    return ctx.reply(
      "📋 <b>RIWAYAT WITHDRAW</b>\n\n" +
      "Belum ada riwayat withdraw.",
      {
        parse_mode: "HTML",
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
    "📋 <b>RIWAYAT WITHDRAW</b>\n\n";

  history.forEach((item, index) => {
    text +=
      `${index + 1}. Rp ${item.amount.toLocaleString("id-ID")}\n` +
      `Status: ${item.status}\n\n`;
  });

  return ctx.reply(text, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🏠 Dashboard",
          "DASHBOARD"
        )
      ]
    ])
  });
});

bot.action("HELP", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.reply(
    "🆘 <b>PUSAT BANTUAN</b>\n\n" +
    "Jika membutuhkan bantuan, silakan hubungi admin resmi.\n\n" +
    `👨‍💼 Admin: @${config.ADMIN_USERNAME}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "👨‍💼 Hubungi Admin",
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
});

bot.catch((error) => {
  console.log("BOT ERROR:", error.message);
});

bot.launch();

console.log("✅ CUAN REWARD BOT AKTIF");
