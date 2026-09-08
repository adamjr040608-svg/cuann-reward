require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const c = require("./config");

const bot = new Telegraf(process.env.BOT_TOKEN);
const DB = "./database.json";

let db = fs.existsSync(DB)
  ? JSON.parse(fs.readFileSync(DB))
  : { users: {}, withdrawals: [] };

const save = () =>
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));

function user(id) {
  id = String(id);

  if (!db.users[id])
    db.users[id] = {
      id,
      balance: c.START_BALANCE,
      referrals: 0,
      referredBy: null,
      wd: null
    };

  return db.users[id];
}

async function joined(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(
      c.CHANNEL,
      ctx.from.id
    );
    return ["member", "administrator", "creator"]
      .includes(m.status);
  } catch {
    return false;
  }
}

async function join(ctx) {
  return ctx.reply(
    "🔒 WAJIB JOIN SALURAN\n\n" +
    "Silakan bergabung ke saluran resmi kami terlebih dahulu.",
    Markup.inlineKeyboard([
      [Markup.button.url("📢 Join Saluran", c.CHANNEL_LINK)],
      [Markup.button.callback("✅ Saya Sudah Bergabung", "CHECK")]
    ])
  );
}

async function dash(ctx) {
  const u = user(ctx.from.id);

  return ctx.reply(
    "🎉 CUAN REWARD\n" +
    "━━━━━━━━━━━━━━\n\n" +
    "Platform referral terpercaya untuk mendapatkan " +
    "penghasilan tambahan dengan mudah dan transparan.\n\n" +

    "👤 ID: " + u.id + "\n" +
    "💰 Saldo: Rp " +
    u.balance.toLocaleString("id-ID") + "\n" +
    "👥 Referral: " + u.referrals + "\n\n" +

    "🎁 Bonus Referral: Rp 35.000\n" +
    "💳 Minimal WD: Rp 150.000\n" +
    "⏱ WD: Diproses admin",
    
    Markup.inlineKeyboard([
      [Markup.button.callback("💰 Hasilkan Uang", "EARN")],
      [
        Markup.button.callback("💳 Withdraw", "WD"),
        Markup.button.callback("📋 Riwayat WD", "HISTORY")
      ],
      [
        Markup.button.url(
          "👨‍💼 Hubungi Admin",
          "https://t.me/" + c.ADMIN_USERNAME
        )
      ]
    ])
  );
}

// START
bot.start(async ctx => {
  if (!(await joined(ctx))) return join(ctx);

  const u = user(ctx.from.id);
  const ref = ctx.startPayload;

  if (ref && ref !== u.id && !u.referredBy && db.users[ref]) {
    u.referredBy = ref;
    db.users[ref].referrals++;
    db.users[ref].balance += c.REFERRAL_BONUS;
    save();

    try {
      await bot.telegram.sendMessage(
        ref,
        "🎉 REFERRAL BERHASIL!\n\n" +
        "Bonus: Rp 35.000\n" +
        "Saldo: Rp " +
        db.users[ref].balance.toLocaleString("id-ID")
      );
    } catch {}
  }

  dash(ctx);
});

// CEK JOIN
bot.action("CHECK", async ctx => {
  await ctx.answerCbQuery();

  if (!(await joined(ctx)))
    return ctx.reply(
      "❌ Kamu belum join saluran.\n\n" +
      "Silakan Join Saluran lalu coba lagi."
    );

  dash(ctx);
});

// PROTEKSI
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  if (
    ctx.message?.text?.startsWith("/start") ||
    ctx.callbackQuery?.data === "CHECK"
  ) return next();

  if (!(await joined(ctx))) return join(ctx);

  next();
});

// DASHBOARD
bot.action("HOME", ctx => dash(ctx));

// REFERRAL
bot.action("EARN", async ctx => {
  await ctx.answerCbQuery();

  const u = user(ctx.from.id);
  const me = await bot.telegram.getMe();

  const link =
    `https://t.me/${me.username}?start=${u.id}`;

  return ctx.reply(
    "💸 PROGRAM REFERRAL CUAN REWARD\n" +
    "━━━━━━━━━━━━━━\n\n" +
    "🎁 Bonus: Rp 35.000 / Orang\n\n" +
    "🔗 Link Referral:\n" +
    link + "\n\n" +
    "Bagikan link tersebut kepada teman.",
    
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "📤 Bagikan Link",
          `https://t.me/share/url?url=${encodeURIComponent(link)}`
        )
      ],
      [Markup.button.callback("🏠 Dashboard", "HOME")]
    ])
  );
});

// WITHDRAW
bot.action("WD", ctx => {
  const u = user(ctx.from.id);

  if (u.balance < c.MIN_WITHDRAW)
    return ctx.reply(
      "❌ SALDO TIDAK MENCUKUPI\n\n" +
      "Saldo: Rp " +
      u.balance.toLocaleString("id-ID") +
      "\nMinimal WD: Rp " +
      c.MIN_WITHDRAW.toLocaleString("id-ID")
    );

  u.wd = { step: "amount" };
  save();

  ctx.reply(
    "💳 WITHDRAW\n\n" +
    "Ketik jumlah WD.\n" +
    "Contoh: 150000"
  );
});

// INPUT WD
bot.on("text", async ctx => {
  const u = user(ctx.from.id);

  if (!u.wd) return;

  const text = ctx.message.text.trim();

  if (u.wd.step === "amount") {
    const amount = Number(text.replace(/\D/g, ""));

    if (
      !amount ||
      amount < c.MIN_WITHDRAW ||
      amount > u.balance
    )
      return ctx.reply(
        "❌ Jumlah tidak valid.\n" +
        "Minimal WD Rp " +
        c.MIN_WITHDRAW.toLocaleString("id-ID") +
        "\nSaldo Rp " +
        u.balance.toLocaleString("id-ID")
      );

    u.wd.amount = amount;
    u.wd.step = "account";
    save();

    return ctx.reply(
      "💙 WD DANA\n\n" +
      "Jumlah: Rp " +
      amount.toLocaleString("id-ID") +
      "\n\nMasukkan nomor DANA kamu."
    );
  }

  if (u.wd.step === "account") {
    u.wd.account = text;

    const w = {
      id: "WD-" + Date.now(),
      userId: u.id,
      amount: u.wd.amount,
      method: "DANA",
      account: u.wd.account,
      status: "PENDING",
      date: new Date().toISOString()
    };

    db.withdrawals.push(w);
    u.balance -= w.amount;
    u.wd = null;
    save();

    try {
      await bot.telegram.sendMessage(
        c.ADMIN_CHAT_ID,
        "🔔 WD BARU\n\n" +
        "ID: " + w.id + "\n" +
        "User: " + w.userId + "\n" +
        "Jumlah: Rp " +
        w.amount.toLocaleString("id-ID") +
        "\nMetode: DANA\n" +
        "Nomor: " + w.account +
        "\nStatus: PENDING"
      );
    } catch (e) {
      console.log("Admin notification error:", e.message);
    }

    return ctx.reply(
      "✅ WD BERHASIL DIAJUKAN\n\n" +
      "ID: " + w.id + "\n" +
      "Jumlah: Rp " +
      w.amount.toLocaleString("id-ID") +
      "\nMetode: DANA\n" +
      "Status: PENDING\n\n" +
      "Pembayaran akan diproses oleh admin."
    );
  }
});

// RIWAYAT
bot.action("HISTORY", ctx => {
  const h = db.withdrawals.filter(
    x => String(x.userId) === String(ctx.from.id)
  );

  if (!h.length)
    return ctx.reply("📋 Belum ada riwayat WD.");

  let t = "📋 RIWAYAT WD\n━━━━━━━━━━━━━━\n\n";

  h.forEach(x => {
    t +=
      "💰 Rp " +
      x.amount.toLocaleString("id-ID") +
      "\n💳 " + x.method +
      "\n⏳ " + x.status +
      "\n\n";
  });

  ctx.reply(t);
});

// ERROR
bot.catch(e => console.log("ERROR:", e.message));

bot.launch();

console.log("✅ CUAN REWARD BOT AKTIF");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
