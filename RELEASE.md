# Releasing AUI Athletics to the App Store and Google Play

Everything technical is ready in this repo:

- **Build config:** `eas.json` and `app.json`
- **Account deletion:** in the app, plus the `delete-account` backend function
- **Public web pages:** privacy policy at https://aui-athletics.vercel.app/privacy and support at https://aui-athletics.vercel.app/support
- **Store material:** texts in `store/listing.md`, privacy answers in `store/privacy-answers.md`, screenshots in `store/screenshots/`, and the feature graphic in `store/feature-graphic.png`

What's left needs your accounts and logins. Allow about 1–2 hours, plus Apple/Google review time.

---

## 0. Before you start

1. **Confirm the support email.** It is set to `athletics@aui.ma` in `src/lib/config.ts` and `store/listing.md`. Change it if the department uses another address, and make sure someone reads it.
2. **Create the accounts.** Use the university/department as the owner wherever possible.
   - **Expo:** https://expo.dev/signup (free).
   - **Apple Developer Program:** https://developer.apple.com/programs/enroll. Enroll as an **organization**, which needs AUI's D-U-N-S number. $99/year; ask about the fee waiver for educational institutions.
   - **Google Play Console:** https://play.google.com/console/signup. Choose **Organization**. $25 one-time. Organization accounts skip the "12 testers for 14 days" rule that applies to new personal accounts.
3. **Install Node.js 20+** on a computer (Windows, Mac or Linux; no Mac needed), then run:

```bash
git clone https://github.com/TahirELGAMRANI/Athletics-APP.git
cd Athletics-APP
npm install
npx eas-cli@latest login       # your Expo account
npx eas-cli@latest init        # links the project; writes extra.eas.projectId into app.json — commit that change
```

---

## 1. iPhone (App Store)

1. **Create the app record.** In App Store Connect → Apps → **+ New App**:
   - Platform iOS, name **AUI Athletics**, language English
   - Bundle ID **ma.aui.athletics** (register it when asked), SKU `aui-athletics`
2. **Link it to the build config.** Copy the app's **Apple ID** (a number shown under App Information) into `eas.json` → `submit.production.ios.ascAppId`.
3. **Build:**
   ```bash
   npx eas-cli@latest build -p ios --profile production
   ```
   Log in with your Apple account when asked. EAS creates the certificates and provisioning profile for you; accept the defaults. The build takes about 15–30 minutes in the cloud.
4. **Upload the build:**
   ```bash
   npx eas-cli@latest submit -p ios --latest
   ```
5. **Test with TestFlight (recommended first).**
   - App Store Connect → TestFlight: add internal testers (up to 100 team members, instant).
   - Or create an external group with a public link (up to 10,000 people, after a short Beta review).
   - Testers install the free **TestFlight** app and open the invite.
6. **Release on the App Store.** App Store Connect → the app → iOS App:
   - Paste the texts from `store/listing.md`.
   - Upload `store/screenshots/ios-6.9/*.png`.
   - App Privacy: use `store/privacy-answers.md`.
   - Age rating: answers in `store/listing.md`.
   - Paste the **review notes** with the demo accounts.
   - Choose the build and click **Submit for Review**. Review usually takes 1–3 days.

   **Unlisted distribution (optional):** to keep the app out of search, request unlisted distribution at https://developer.apple.com/contact/request/unlisted-app/ after approval. Only people with the link can then install it.

---

## 2. Android (Google Play)

1. **Create the app.** Play Console → **Create app**:
   - Name **AUI Athletics**, English, App, Free
   - Accept the declarations
2. **First upload (by hand).** Google requires the very first upload to be manual:
   ```bash
   npx eas-cli@latest build -p android --profile production
   ```
   - Download the `.aab` file from the link EAS prints.
   - Play Console → Testing → **Internal testing** → Create release → upload the `.aab` → add testers' emails → Save → Roll out.
   - Accept **Play App Signing** when asked.
3. **Fill in "App content".** Play Console → Policy → App content:
   - **Privacy policy:** https://aui-athletics.vercel.app/privacy
   - **App access:** "All or some functionality is restricted". Add the demo accounts from `store/listing.md`.
   - **Ads:** No.
   - **Content rating:** IARC questionnaire (answers in `store/listing.md`).
   - **Target audience:** 18+ (university).
   - **Data safety:** use `store/privacy-answers.md`.
   - **Data deletion URL:** https://aui-athletics.vercel.app/support
4. **Store listing.** Paste the texts and upload:
   - `store/screenshots/android-phone/*.png`
   - `store/feature-graphic.png` (1024×500)
   - `public/pwa-512.png` (512×512 icon)
5. **Automatic uploads afterwards (optional).** Create a Google Cloud service account with Play Console access (Play Console → Setup → API access). Save its JSON key as `google-play-service-account.json` in the repo root; it is git-ignored, so never commit it. Future releases then need only:
   ```bash
   npx eas-cli@latest build -p android --profile production
   npx eas-cli@latest submit -p android --latest     # goes to the internal track as a draft
   ```
6. **Go public.** Promote the release from Internal testing → Closed or Production when ready.

**No store at all:** `npx eas-cli@latest build -p android --profile preview` produces an `.apk`. Anyone can install it from the download link, after allowing "install unknown apps".

---

## 3. Releasing updates later

| What changed | What to do |
|---|---|
| Screens, text, logic (JavaScript only) | Bump nothing. Rebuild and submit: `eas build -p all --profile production` then `eas submit -p all --latest`. Build numbers auto-increment (`autoIncrement`, remote versioning). |
| A user-visible new version | Change `expo.version` in `app.json` (e.g. `1.1.0`), then build and submit. |
| Web version | Merge to `main`; Vercel redeploys automatically. |

For instant fixes without store review, you can later enable over-the-air updates:
1. Run `npx expo install expo-updates` and `npx eas-cli@latest update:configure`.
2. Build and submit once.
3. After that, `npx eas-cli@latest update --branch production` pushes JavaScript changes straight to installed apps.

---

## 4. Checklist

- [ ] Support email confirmed (`src/lib/config.ts`)
- [ ] `eas init` run and `app.json` change committed
- [ ] Apple: app record created, `ascAppId` set in `eas.json`
- [ ] iOS build → TestFlight → tested on a real iPhone
- [ ] Google: app created, first `.aab` uploaded to Internal testing
- [ ] Store listings, screenshots, privacy/data-safety, age rating, review notes filled
- [ ] Demo accounts still active (`Lions2026!`) during review
- [ ] Submitted for review on both stores
