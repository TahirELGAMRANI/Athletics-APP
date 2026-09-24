# Privacy questionnaires

Answers for Apple's **App Privacy** section (App Store Connect → App Privacy) and Google's **Data safety** form (Play Console → App content). They match what the app actually does and the published policy at https://aui-athletics.vercel.app/privacy.

## Apple — App Privacy

**Do you or your third-party partners collect data from this app?** Yes.
**Is any data used to track users?** No. (No ads, no analytics SDKs, no data brokers.)

| Data type (Apple category) | Collected | Linked to the user | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes (optional) | Yes | No | App Functionality |
| Health & Fitness → Fitness | Yes (athletes) | Yes | No | App Functionality |
| Health & Fitness → Health | Yes (medical/psychology documents uploaded by staff) | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes (document photos) | Yes | No | App Functionality |
| User Content → Other User Content | Yes (training ratings and feedback) | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Sensitive Info | Yes (staff salary and ID numbers, entered by the director) | Yes | No | App Functionality |

Not collected: location, contacts, browsing/search history, purchases, financial info of users, diagnostics, usage data, advertising data.

## Google Play — Data safety

* **Does your app collect or share any of the required user data types?** Yes.
* **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS).
* **Do you provide a way for users to request that their data is deleted?** Yes — in-app (Profile → Delete my account) and by email (see the privacy policy).
* **Data shared with third parties:** None. (Supabase and Vercel act as service providers processing data on our behalf, which Google does not count as sharing.)

| Category → type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → Name | Yes | No | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | App functionality, Account management |
| Personal info → Phone number | Yes | No | Optional | App functionality |
| Personal info → Other info (staff ID number, address) | Yes | No | Optional | App functionality |
| Financial info → Other financial info (staff salary) | Yes | No | Optional | App functionality |
| Health and fitness → Health info | Yes | No | Optional | App functionality |
| Health and fitness → Fitness info | Yes | No | Optional | App functionality |
| Photos and videos → Photos | Yes | No | Optional | App functionality |
| App activity → Other user-generated content | Yes | No | Optional | App functionality |

**Account deletion URL** (Play asks for a web link): https://aui-athletics.vercel.app/support — it explains deletion in the app and by email.
