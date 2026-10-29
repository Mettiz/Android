<div align="center" dir="rtl">

# 📱 سامانه هوشمند مدیریت شیفت تولید (ShiftFlow FMD)

**اپلیکیشن اندروید و سامانه جامع تحت وب برای زمان‌بندی، تحلیل عدالت کاری و مدیریت چرخه تولید**

[![Android APK](https://img.shields.io/badge/Android_APK-v2.5.0_(Signed)-059669?style=for-the-badge&logo=android&logoColor=white)](./public/ShiftFlow-FMD.apk)
[![Package ID](https://img.shields.io/badge/Package-ir.fmd.shiftflow.app-0f766e?style=for-the-badge&logo=googleplay&logoColor=white)](./public/ShiftFlow-FMD-Android-Package.zip)
[![React 19](https://img.shields.io/badge/React_19-TypeScript-4f46e5?style=for-the-badge&logo=react&logoColor=white)](./package.json)

---

### 📥 [دانلود مستقیم فایل نصبی اندروید (`ShiftFlow-FMD.apk` — 936 KB)](./public/ShiftFlow-FMD.apk)
### 📦 [دانلود پکیج کامل اندروید (`APK + AAB + Keystore`)](./public/ShiftFlow-FMD-Android-Package.zip)

</div>

---

## ✨ ویژگی‌های کلیدی اپلیکیشن اندروید و وب

### ۱. اپلیکیشن بومی اندروید (`ir.fmd.shiftflow.app`)
- **نصب تمام‌صفحه (Signed APK & TWA/WebView):** اجرای مستقل روی تمام گوشی‌های اندروید بدون نوار آدرس مرورگر.
- **اعلان هوشمند شیفت (Status Bar Notifications):** نمایش اسامی شیفت روز، شب و سرشیفت آنکال در نوار اعلان گوشی.
- **قفل روشن ماندن صفحه (Screen Wake Lock):** جلوگیری از خاموش شدن صفحه هنگام بررسی جدول در خط تولید.
- **کارکرد آفلاین و همگام‌سازی ابری آنی:** ذخیره کامل برنامه در حافظه گوشی و همگام‌سازی خودکار با سرور به محض اتصال اینترنت.

### ۲. ورود مستقیم برنامه از فایل PDF سامانه
- استخراج ۱۰۰٪ دقیق جدول شیفت‌های ماهانه از فایل‌های PDF رسمی سامانه (پشتیبانی کامل از فونت‌های فارسی، شیفت‌های دونفره روز و شب و نفرات کمکی).
- انتقال خودکار تقویم داشبورد به ماه استخراج‌شده بلافاصله پس از بارگذاری PDF.

### ۳. داشبورد عدالت و تحلیل بار کاری (Justice Dashboard)
- محاسبه دقیق شیفت‌های روز (۱۱ ساعت)، شیفت‌های شب (۱۳ ساعت) و امتیاز وزنی (ضریب ۱.۵ برای شیفت شب).
- نمایش گرافیکی توازن کاری، ساعات استراحت (OFF) و گزارش کارکرد فردی هر کارشناس با قابلیت چاپ استاندارد A4 و خروجی اکسل.

---

## ⚡ اتصال به ورسل (Vercel) — رفع ۱۰۰٪ فیلترینگ و تحریم در ایران (بدون نیاز به VPN)

برای اینکه اعمال شیفت‌ها توسط مدیر و دریافت نوتیفیکیشن‌ها برای پرسنل **بدون نیاز به هیچ‌گونه فیلترشکن** کار کند، پروژه برای استقرار خودکار روی **Vercel** کانفیگ شده است:

### مراحل اتصال مخزن گیت‌هاب شما به Vercel (کمتر از ۱ دقیقه):
1. وارد سایت [vercel.com](https://vercel.com) شوید و با اکانت گیت‌هاب لاگین کنید.
2. روی **Add New...** کلیک کرده و **Project** را انتخاب کنید.
3. مخزن **`Mettiz/Android`** را از لیست انتخاب کرده و روی **Import** و سپس **Deploy** بزنید.
4. ورسل به طور خودکار کد را با دستور `npm run build` بیلد کرده و به شما یک دامنه رایگان بدون فیلتر (مثلاً `https://shiftflow-fmd.vercel.app`) می‌دهد.
5. **نتیجه:**
   - تمام اندپوینت‌های `/api/sync` روی ورسل اجرا می‌شوند و دیتابیس را بدون تحریم به روز می‌کنند.
   - در اپلیکیشن اندروید، در زبانه تنظیمات پیشرفته (آیکون اندروید بالا) &rarr; بخش **«اتصال به سرور Vercel»**، کافیست آدرس ورسل خود را وارد کرده و دکمه **ذخیره** را بزنید.
   - از این لحظه به بعد، کل سینک شیفت‌ها و اعلان‌ها بدون قطعی و بدون فیلترشکن انجام خواهد شد!

---

## 🤖 ساخت خودکار نسخه اندروید و بخش Releases در GitHub (مشابه پروژه‌های FoxyVPN)

این ریپازیتوری دارای فایل‌های آماده برای کامپایل خودکار اندروید با **GitHub Actions** و **Capacitor / Gradle** است:

### روش اول: انتشار دستی فوری در بخش Releases گیت‌هاب (۳۰ ثانیه)
1. در صفحه اصلی ریپازیتوری خود در گیت‌هاب، از ستون سمت راست روی **Releases** (یا **Create a new release**) کلیک کنید.
2. یک تگ مانند `v2.5.0` انتخاب کرده و عنوان را `ShiftFlow FMD Android v2.5.0` بگذارید.
3. فایل [`public/ShiftFlow-FMD.apk`](./public/ShiftFlow-FMD.apk) را در کادر **Attach binaries** بکشید و رها کنید و روی **Publish release** بزنید.

### روش دوم: کامپایل و انتشار ۱۰۰٪ خودکار با GitHub Actions
1. در صفحه گیت‌هاب ریپازیتوری خود، روی **Add file &rarr; Create new file** کلیک کنید.
2. در کادر نام فایل بنویسید:
   ```text
   .github/workflows/android-release.yml
   ```
3. محتوای فایل آماده [`public/github-android-release.yml`](./public/github-android-release.yml) را در آن کپی کرده و روی **Commit changes** کلیک کنید.
4. گیت‌هاب به‌صورت خودکار سرور Ubuntu + JDK 21 + Android SDK را راه‌اندازی کرده، فایل `.apk` را کامپایل می‌کند و در بخش **Releases** ریپازیتوری شما منتشر می‌نماید.

---

## 🛠 بیلد محلی اندروید در Android Studio (Capacitor CLI)

```bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## 🔐 مشخصات امضای دیجیتال نسخه رسمی اندروید
- **Package Name:** `ir.fmd.shiftflow.app`
- **Version:** `2.5.0 (versionCode: 2)`
- **SHA-256 Certificate Fingerprint:**
  ```text
  26:D3:18:69:9D:99:B3:27:59:47:1D:64:AD:F4:18:6C:05:D7:BE:07:4A:23:42:C3:C2:40:B8:83:FB:FE:30:C3
  ```