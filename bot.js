require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const bot = new Telegraf(process.env.BOT_TOKEN);

const DB_FILE = "./database.json";

// ==========================================
// DATABASE
// ==========================================

let db = {
  users: {},
  withdrawals: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    if (!db.users) {
      db.users = {};
    }

    if (!db.withdrawals) {
      db.withdrawals = [];
    }

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

async function saveUserToSupabase(user) {
  const { error } = await supabase
    .from("users")
    .upsert({
      id: String(user.id),
      balance: Number(user.balance || 0),
      referrals: Number(user.referrals || 0),
      referred_by: user.referredBy ? String(user.referredBy) : null
    });

  if (error) {
    console.error("Supabase save error:", error.message);
  }
}

// ==========================================
// USER
// ==========================================

function getUser(userId) {

  const id = String(userId);

  if (!db.users[id]) {

    db.users[id] = {

      id: id,

      balance:
        config.START_BALANCE,

      referrals:
        0,

      referredBy:
        null,

      withdrawStep:
        null,

      withdrawAmount:
        null,

      withdrawMethod:
        null,

      withdrawAccount:
        null

    };

    saveDB();
  }

  return db.users[id];
}

// ==========================================
// CEK JOIN SALURAN
// ==========================================

async function isMember(ctx) {

  try {

    const member =
      await ctx.telegram.getChatMember(
        config.CHANNEL,
        ctx.from.id
      );

    return [
      "creator",
      "administrator",
      "member"
    ].includes(member.status);

  } catch (error) {

    console.log(
      "Gagal cek member:",
      error.message
    );

    return false;
  }
}

// ==========================================
// HALAMAN WAJIB JOIN
// ==========================================

async function showJoin(ctx) {

  return ctx.reply(

    "🔒 AKSES TERKUNCI\n" +
    "━━━━━━━━━━━━━━━━━━━━\n\n" +

    "Untuk menggunakan CUAN REWARD,\n" +
    "kamu wajib bergabung ke saluran resmi kami.\n\n" +

    "📢 Langkah 1: Klik Join Saluran\n" +
    "📢 Langkah 2: Bergabung ke saluran\n" +
    "📢 Langkah 3: Tekan Saya Sudah Bergabung\n\n" +

    "Setelah berhasil bergabung, kamu dapat\n" +
    "mengakses seluruh fitur bot.",

    Markup.inlineKeyboard([

      [
        Markup.button.url(
          "📢 Join Saluran",
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

// ==========================================
// DASHBOARD
// ==========================================

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

    "💡 Klik menu 💰 Hasilkan Uang untuk\n" +
    "membagikan link referral kamu.";

  return ctx.reply(

    text,

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

    ])
  );
}

// ==========================================
// START
// ==========================================

bot.start(async (ctx) => {

  const user = getUser(ctx.from.id);
  const ref = ctx.startPayload || "";

  // PROSES REFERRAL
  if (
    ref &&
    ref !== String(ctx.from.id) &&
    !user.referredBy &&
    db.users[ref]
  ) {

    user.referredBy = ref;

    db.users[ref].referrals += 1;

    db.users[ref].balance +=
      config.REFERRAL_BONUS;

    saveDB();

    try {
      await bot.telegram.sendMessage(
        ref,
        "🎉 REFERRAL BERHASIL!\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +
        "👤 Teman baru masuk melalui link kamu.\n\n" +
        "🎁 Bonus: Rp " +
        config.REFERRAL_BONUS.toLocaleString("id-ID") +
        "\n\n" +
        "💰 Saldo sekarang: Rp " +
        db.users[ref].balance.toLocaleString("id-ID") +
        "\n" +
        "👥 Referral: " +
        db.users[ref].referrals +
        " Orang"
      );
    } catch (error) {
      console.log(
        "Gagal kirim notifikasi referral:",
        error.message
      );
    }
  }

  // CEK WAJIB JOIN SETELAH REFERRAL DIPROSES
  if (!(await isMember(ctx))) {
    return showJoin(ctx);
  }

  return dashboard(ctx);
});
// ==========================================
// CEK JOIN
// ==========================================

bot.action(
  "CHECK_JOIN",
  async (ctx) => {

    await ctx.answerCbQuery();

    const joined =
      await isMember(ctx);

    if (!joined) {

      return ctx.reply(

        "❌ BELUM BERGABUNG\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "Kamu belum terdeteksi bergabung\n" +
        "ke saluran resmi.\n\n" +

        "Silakan tekan Join Saluran terlebih dahulu,\n" +
        "kemudian tekan Saya Sudah Bergabung."

      );
    }

    return dashboard(ctx);
  }
);

// ==========================================
// PROTEKSI SEMUA MENU
// ==========================================

bot.use(async (ctx, next) => {

  // Abaikan update tertentu
  if (
    !ctx.from ||
    ctx.updateType === "my_chat_member"
  ) {
    return next();
  }

  // START sudah memiliki pengecekan sendiri
  if (
    ctx.message &&
    ctx.message.text &&
    ctx.message.text.startsWith("/start")
  ) {
    return next();
  }

  // CHECK JOIN
  if (
    ctx.callbackQuery &&
    ctx.callbackQuery.data ===
    "CHECK_JOIN"
  ) {
    return next();
  }

  const joined =
    await isMember(ctx);

  if (!joined) {

    return showJoin(ctx);
  }

  return next();
});

// ==========================================
// DASHBOARD BUTTON
// ==========================================

bot.action(
  "DASHBOARD",
  async (ctx) => {

    await ctx.answerCbQuery();

    return dashboard(ctx);
  }
);

// ==========================================
// HASILKAN UANG
// ==========================================

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

      encodeURIComponent(
        referralLink
      ) +

      "&text=" +

      encodeURIComponent(
        "Yuk daftar melalui link referral saya!"
      );

    const text =

      "💸 PROGRAM REFERRAL CUAN REWARD\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "Bagikan link referral unik Anda kepada\n" +
      "teman atau ke media sosial untuk\n" +
      "mendapatkan penghasilan tambahan secara\n" +
      "instan!\n\n" +

      "🎁 Bonus Referral: Rp " +

      config.REFERRAL_BONUS
        .toLocaleString("id-ID") +

      " / Orang\n\n" +

      "🔗 Link Referral Anda:\n" +

      referralLink +

      "\n\n" +

      "💡 Semakin banyak teman yang bergabung\n" +
      "menggunakan link Anda, semakin besar\n" +
      "saldo yang bisa Anda tarik!";

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

// ==========================================
// WITHDRAW
// ==========================================

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

        "💰 Saldo Anda: Rp " +

        user.balance
          .toLocaleString("id-ID") +

        "\n" +

        "💳 Minimal WD: Rp " +

        config.MIN_WITHDRAW
          .toLocaleString("id-ID") +

        "\n\n" +

        "Silakan kumpulkan saldo tambahan\n" +
        "melalui menu 💰 Hasilkan Uang."

      );
    }

    user.withdrawStep =
      "amount";

    user.withdrawAmount =
      null;

    user.withdrawMethod =
      null;

    user.withdrawAccount =
      null;

    saveDB();

    return ctx.reply(

      "💳 PENGAJUAN WITHDRAW\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "💰 Saldo Anda: Rp " +

      user.balance
        .toLocaleString("id-ID") +

      "\n\n" +

      "Ketik jumlah WD yang ingin diajukan.\n\n" +

      "Contoh:\n" +
      "150000"

    );
  }
);

// ==========================================
// INPUT WD
// ==========================================

bot.on(
  "text",
  async (ctx, next) => {

    const user =
      getUser(ctx.from.id);

    if (!user.withdrawStep) {
      return next();
    }

    const text =
      ctx.message.text.trim();

    // ======================================
    // JUMLAH
    // ======================================

    if (
      user.withdrawStep ===
      "amount"
    ) {

      const amount =
        Number(
          text.replace(/\D/g, "")
        );

      if (!amount) {

        return ctx.reply(
          "❌ Jumlah tidak valid.\n\nContoh: 150000"
        );
      }

      if (
        amount <
        config.MIN_WITHDRAW
      ) {

        return ctx.reply(

          "❌ JUMLAH TERLALU KECIL\n\n" +

          "Minimal WD: Rp " +

          config.MIN_WITHDRAW
            .toLocaleString("id-ID")

        );
      }

      if (
        amount >
        user.balance
      ) {

        return ctx.reply(

          "❌ SALDO TIDAK CUKUP\n\n" +

          "Saldo Anda: Rp " +

          user.balance
            .toLocaleString("id-ID")

        );
      }

      user.withdrawAmount =
        amount;

      user.withdrawStep =
        "method";

      saveDB();

      return ctx.reply(

        "💳 PILIH METODE WD\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "💰 Jumlah WD: Rp " +

        amount
          .toLocaleString("id-ID") +

        "\n\n" +

        "Pilih metode pencairan:",

        Markup.inlineKeyboard([

          [
            Markup.button.callback(
              "💙 DANA",
              "WD_DANA"
            )
          ],

          [
            Markup.button.callback(
              "🟣 OVO",
              "WD_OVO"
            ),

            Markup.button.callback(
              "🟢 GoPay",
              "WD_GOPAY"
            )
          ],

          [
            Markup.button.callback(
              "🏦 BANK",
              "WD_BANK"
            )
          ]

        ])
      );
    }

    // ======================================
    // NOMOR AKUN
    // ======================================

    if (
      user.withdrawStep ===
      "account"
    ) {

      user.withdrawAccount =
        text;

      user.withdrawStep =
        "confirm";

      saveDB();

      return ctx.reply(

        "🔎 KONFIRMASI WITHDRAW\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "💰 Jumlah: Rp " +

        user.withdrawAmount
          .toLocaleString("id-ID") +

        "\n" +

        "💳 Metode: " +
        user.withdrawMethod +
        "\n" +

        "📱 Nomor/Rekening: " +
        user.withdrawAccount +
        "\n\n" +

        "Apakah data sudah benar?",

        Markup.inlineKeyboard([

          [
            Markup.button.callback(
              "✅ KONFIRMASI",
              "WD_CONFIRM"
            )
          ],

          [
            Markup.button.callback(
              "❌ BATAL",
              "WD_CANCEL"
            )
          ]

        ])
      );
    }

    return next();
  }
);

// ==========================================
// DANA
// ==========================================

bot.action(
  "WD_DANA",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    user.withdrawMethod =
      "DANA";

    user.withdrawStep =
      "account";

    saveDB();

    return ctx.reply(

      "💙 WD DANA\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "💰 Jumlah: Rp " +

      user.withdrawAmount
        .toLocaleString("id-ID") +

      "\n\n" +

      "Masukkan nomor DANA kamu."

    );
  }
);

// ==========================================
// OVO
// ==========================================

bot.action(
  "WD_OVO",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    user.withdrawMethod =
      "OVO";

    user.withdrawStep =
      "account";

    saveDB();

    return ctx.reply(

      "🟣 WD OVO\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "💰 Jumlah: Rp " +

      user.withdrawAmount
        .toLocaleString("id-ID") +

      "\n\n" +

      "Masukkan nomor OVO kamu."

    );
  }
);

// ==========================================
// GOPAY
// ==========================================

bot.action(
  "WD_GOPAY",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    user.withdrawMethod =
      "GoPay";

    user.withdrawStep =
      "account";

    saveDB();

    return ctx.reply(

      "🟢 WD GOPAY\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "💰 Jumlah: Rp " +

      user.withdrawAmount
        .toLocaleString("id-ID") +

      "\n\n" +

      "Masukkan nomor GoPay kamu."

    );
  }
);

// ==========================================
// BANK
// ==========================================

bot.action(
  "WD_BANK",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    user.withdrawMethod =
      "BANK";

    user.withdrawStep =
      "account";

    saveDB();

    return ctx.reply(

      "🏦 WD BANK\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "💰 Jumlah: Rp " +

      user.withdrawAmount
        .toLocaleString("id-ID") +

      "\n\n" +

      "Masukkan nomor rekening bank kamu."

    );
  }
);

// ==========================================
// KONFIRMASI WD
// ==========================================

bot.action(
  "WD_CONFIRM",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    if (
      !user.withdrawAmount ||
      !user.withdrawMethod ||
      !user.withdrawAccount
    ) {

      return ctx.reply(
        "❌ DATA WD TIDAK LENGKAP."
      );
    }

    const amount =
      Number(user.withdrawAmount);

    if (
      amount <
      config.MIN_WITHDRAW
    ) {

      return ctx.reply(
        "❌ Jumlah WD tidak memenuhi minimum."
      );
    }

    if (
      amount >
      user.balance
    ) {

      user.withdrawStep =
        null;

      saveDB();

      return ctx.reply(
        "❌ SALDO TIDAK CUKUP."
      );
    }

    // ======================================
    // BUAT DATA WITHDRAW
    // ======================================

    const withdrawal = {

      id:
        "WD-" +
        Date.now(),

      userId:
        String(ctx.from.id),

      username:
        ctx.from.username || "",

      name:
        ctx.from.first_name || "",

      amount:
        amount,

      method:
        user.withdrawMethod,

      account:
        user.withdrawAccount,

      status:
        "PENDING",

      createdAt:
        new Date().toISOString()

    };

    db.withdrawals.push(
      withdrawal
    );

    // Potong saldo

    user.balance -=
      amount;

    // Reset proses WD

    user.withdrawStep =
      null;

    user.withdrawAmount =
      null;

    user.withdrawMethod =
      null;

    user.withdrawAccount =
      null;

    saveDB();

    // ======================================
    // NOTIFIKASI ADMIN
    // ======================================

    try {

      await bot.telegram.sendMessage(

        config.ADMIN_CHAT_ID,

        "🔔 PENGAJUAN WD BARU\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +

        "🆔 ID WD: " +
        withdrawal.id +
        "\n" +

        "👤 User ID: " +
        withdrawal.userId +
        "\n" +

        "👤 Nama: " +
        withdrawal.name +
        "\n" +

        "🔗 Username: @" +
        (
          withdrawal.username ||
          "-"
        ) +
        "\n\n" +

        "💰 Jumlah: Rp " +

        amount
          .toLocaleString("id-ID") +

        "\n" +

        "💳 Metode: " +
        withdrawal.method +
        "\n" +

        "📱 Nomor/Rekening: " +
        withdrawal.account +
        "\n\n" +

        "⏳ Status: PENDING\n\n" +

        "Silakan proses pembayaran."

      );

    } catch (error) {

      console.log(
        "Gagal mengirim notifikasi WD:",
        error.message
      );

    }

    return ctx.reply(

      "✅ WD BERHASIL DIAJUKAN\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +

      "🆔 ID WD: " +
      withdrawal.id +
      "\n" +

      "💰 Jumlah: Rp " +

      amount
        .toLocaleString("id-ID") +

      "\n" +

      "💳 Metode: " +
      withdrawal.method +
      "\n\n" +

      "⏳ Status: PENDING\n\n" +

      "Pengajuan sudah dikirim ke admin.\n" +
      "Pembayaran akan diproses oleh admin."

    );
  }
);

// ==========================================
// BATAL WD
// ==========================================

bot.action(
  "WD_CANCEL",
  async (ctx) => {

    await ctx.answerCbQuery();

    const user =
      getUser(ctx.from.id);

    user.withdrawStep =
      null;

    user.withdrawAmount =
      null;

    user.withdrawMethod =
      null;

    user.withdrawAccount =
      null;

    saveDB();

    return ctx.reply(
      "❌ PENGAJUAN WD DIBATALKAN."
    );
  }
);

// ==========================================
// RIWAYAT WD
// ==========================================

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

        "Belum ada riwayat withdraw."

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

          "│ Metode: " +
          item.method +
          "\n" +

          "│ Status: " +
          item.status +
          "\n\n";

      }
    );

    return ctx.reply(text)
    }
);

// ==========================================
// ERROR HANDLER
// ==========================================

bot.catch((error) => {

  console.log(
    "BOT ERROR:",
    error
  );

});

// ==========================================
// JALANKAN BOT
// ==========================================

bot.launch();

console.log(
  "✅ CUAN REWARD BOT AKTIF"
);

// ==========================================
// STOP
// ==========================================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
